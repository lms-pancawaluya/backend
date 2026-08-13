// src/modules/evaluations/evaluations.service.js

const prisma = require('../../config/database')

// ================================================
// GET EVALUATIONS BY MODULE
// ================================================
const getEvaluationsByModule = async (moduleId) => {
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { moduleId },
    select: {
      id: true,
      judul: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      _count: {
        select: { questions: true }
      }
    }
  })

  return evaluations
}

// ================================================
// GET EVALUATION BY ID + SOAL PG
// ================================================
const getEvaluationById = async (id) => {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: {
      id: true,
      judul: true,
      moduleId: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      questions: {
        select: {
          id: true,
          pertanyaan: true,
          tipe: true,
          // Sembunyikan isCorrect agar tidak bocor ke user/guru
          options: {
            select: {
              id: true,
              teksOpsi: true
            }
          }
        }
      }
    }
  })

  if (!evaluation) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  return evaluation
}

// ================================================
// CREATE EVALUATION
// ================================================
const createEvaluation = async (moduleId, data) => {
  const { judul, passingScore, maxAttempts } = data

  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const evaluationBaru = await prisma.evaluation.create({
    data: { 
      moduleId, 
      judul,
      passingScore: passingScore || 80,
      maxAttempts: maxAttempts || 3
    }
  })

  return evaluationBaru
}

// ================================================
// CREATE QUESTION + OPTIONS (Murni PG)
// ================================================
const createQuestion = async (evaluationId, data) => {
  const { pertanyaan, options } = data

  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId }
  })

  if (!evaluationAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  if (!options || options.length < 2) {
    throw new Error('Soal pilihan ganda harus memiliki minimal 2 pilihan jawaban')
  }

  const adaJawabanBenar = options.some(opt => opt.isCorrect === true)
  if (!adaJawabanBenar) {
    throw new Error('Harus ada minimal 1 jawaban yang benar')
  }

  const questionBaru = await prisma.question.create({
    data: {
      evaluationId,
      pertanyaan,
      tipe: 'pilihan_ganda',
      options: {
        create: options.map(opt => ({
          teksOpsi: opt.teksOpsi,
          isCorrect: opt.isCorrect || false
        }))
      }
    },
    include: {
      options: true
    }
  })

  return questionBaru
}

// ================================================
// SUBMIT JAWABAN — Auto-Grading & Rules Scoring
// ================================================
const submitJawaban = async (evaluationId, userId, data) => {
  const { jawaban } = data
  // jawaban = array: [{ questionId, jawaban }] (jawaban berisi optionId)

  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      questions: {
        include: { options: true }
      }
    }
  })

  if (!evaluationAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const totalSoal = evaluationAda.questions.length
  if (totalSoal === 0) {
    throw new Error('Evaluasi ini belum memiliki soal')
  }

  let totalBenar = 0

  // 1. Simpan/Update Jawaban User & Hitung Skor Pilihan Ganda
  await Promise.all(
    jawaban.map(async (item) => {
      const question = evaluationAda.questions.find(
        q => q.id === item.questionId
      )

      if (!question) {
        throw new Error(`Soal dengan id ${item.questionId} tidak ditemukan`)
      }

      // Cek apakah Option ID yang dipilih bernilai true (isCorrect)
      const pilihanBenar = question.options.find(
        opt => opt.id === item.jawaban && opt.isCorrect
      )
      
      const isCorrect = !!pilihanBenar
      if (isCorrect) totalBenar++

      return prisma.user_answers.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId: item.questionId
          }
        },
        update: {
          jawaban: item.jawaban,
          isCorrect
        },
        create: {
          userId,
          questionId: item.questionId,
          jawaban: item.jawaban,
          isCorrect
        }
      })
    })
  )

  // 2. Kalkulasi Nilai
  const skor = Math.round((totalBenar / totalSoal) * 100)
  const passingScore = evaluationAda.passingScore || 80
  const maxAttempts = evaluationAda.maxAttempts || 3
  const isLolos = skor >= passingScore

  // 3. Ambil / Update Status Progress User di Modul Ini
  let progress = await prisma.user_progress.findUnique({
    where: {
      userId_moduleId: {
        userId,
        moduleId: evaluationAda.moduleId
      }
    }
  })

  let currentAttempts = (progress?.attempts || 0) + 1
  let mustRepeat = false
  let statusProgress = isLolos ? 'selesai' : 'sedang_belajar'

  // Logika jika gagal & sudah melebihi/mencapai batas percobaan (3x)
  if (!isLolos && currentAttempts >= maxAttempts) {
    mustRepeat = true
    statusProgress = 'belum_mulai' // Reset progress modul ke 'belum_mulai' agar baca ulang
  }

  if (progress) {
    await prisma.user_progress.update({
      where: { id: progress.id },
      data: {
        skor,
        status: statusProgress,
        attempts: mustRepeat ? 0 : currentAttempts,
        completedAt: isLolos ? new Date() : null
      }
    })
  } else {
    await prisma.user_progress.create({
      data: {
        userId,
        moduleId: evaluationAda.moduleId,
        skor,
        status: statusProgress,
        attempts: mustRepeat ? 0 : currentAttempts,
        completedAt: isLolos ? new Date() : null
      }
    })
  }

  // 4. Return Output Detail ke Frontend
  return {
    totalSoal,
    benar: totalBenar,
    salah: totalSoal - totalBenar,
    skor,
    passingScore,
    isLolos,
    percobaanKe: currentAttempts,
    sisaPercobaan: Math.max(0, maxAttempts - currentAttempts),
    mustRepeat,
    pesan: isLolos
      ? 'Selamat! Kamu lolos evaluasi modul ini.'
      : mustRepeat
      ? `Kamu telah gagal ${maxAttempts}x. Status modul di-reset, kamu harus mengulang mempelajari materi dari awal!`
      : `Nilai kamu (${skor}) belum mencapai standar minimal (${passingScore}%). Sisa percobaan: ${maxAttempts - currentAttempts}`
  }
}

// ================================================
// GET ANSWERS — Admin melihat seluruh hasil evaluasi
// ================================================
const getAnswersByEvaluation = async (evaluationId) => {
  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId }
  })

  if (!evaluationAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const answers = await prisma.user_answers.findMany({
    where: {
      question: { evaluationId }
    },
    select: {
      id: true,
      jawaban: true,
      isCorrect: true,
      createdAt: true,
      user: {
        select: { id: true, nama: true, email: true, sekolah: true }
      },
      question: {
        select: {
          id: true,
          pertanyaan: true,
          options: {
            select: {
              id: true,
              teksOpsi: true,
              isCorrect: true // Admin dapat melihat mana opsi yang benar
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return answers
}

// ================================================
// GET MY ANSWERS — User/Guru melihat riwayat jawabannya
// ================================================
const getMyAnswers = async (evaluationId, userId) => {
  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId }
  })

  if (!evaluationAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const answers = await prisma.user_answers.findMany({
    where: {
      userId,
      question: { evaluationId }
    },
    select: {
      id: true,
      jawaban: true,
      isCorrect: true,
      createdAt: true,
      question: {
        select: {
          id: true,
          pertanyaan: true,
          options: {
            select: {
              id: true,
              teksOpsi: true
            }
          }
        }
      }
    }
  })

  const benar = answers.filter(a => a.isCorrect === true).length
  const total = answers.length

  return {
    skor: total > 0 ? Math.round((benar / total) * 100) : 0,
    benar,
    totalSoal: total,
    jawaban: answers
  }
}

module.exports = {
  getEvaluationsByModule,
  getEvaluationById,
  createEvaluation,
  createQuestion,
  submitJawaban,
  getAnswersByEvaluation,
  getMyAnswers 
}