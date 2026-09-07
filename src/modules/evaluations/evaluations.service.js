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
      tipe: true, // pre_test, post_test, atau module_eval
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { createdAt: 'asc' }
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
      tipe: true,
      moduleId: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      questions: {
        select: {
          id: true,
          pertanyaan: true,
          tipe: true,
          // Sembunyikan isCorrect agar kunci jawaban tidak bocor ke frontend
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
// CREATE EVALUATION (Dukungan Pre-Test & Post-Test)
// ================================================
const createEvaluation = async (moduleId, data) => {
  const { judul, tipe, passingScore, maxAttempts } = data

  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const isPreTest = tipe === 'pre_test'

  const evaluationBaru = await prisma.evaluation.create({
    data: { 
      moduleId, 
      judul,
      tipe: tipe || 'post_test',
      // Pre-Test tidak perlu passing score & default 1x attempt
      passingScore: isPreTest ? 0 : (passingScore || 80),
      maxAttempts: isPreTest ? 1 : (maxAttempts || 3)
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
// SUBMIT JAWABAN — Auto-Grading (Pre-Test vs Post-Test)
// ================================================
const submitJawaban = async (evaluationId, userId, data) => {
  const { jawaban } = data

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

  // 1. Simpan/Update Jawaban User
  await Promise.all(
    jawaban.map(async (item) => {
      const question = evaluationAda.questions.find(
        q => q.id === item.questionId
      )

      if (!question) {
        throw new Error(`Soal dengan id ${item.questionId} tidak ditemukan`)
      }

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
  const isPreTest = evaluationAda.tipe === 'pre_test'
  const passingScore = isPreTest ? 0 : (evaluationAda.passingScore || 80)
  const maxAttempts = isPreTest ? 1 : (evaluationAda.maxAttempts || 3)
  const isLolos = skor >= passingScore

  // 3. Status Progress User di Modul Ini
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
  let statusProgress = progress?.status || 'belum_mulai'

  // Logika pembeda Pre-Test & Post-Test
  if (isPreTest) {
    // Pre-test langsung mengubah status modul agar user bisa belajar
    statusProgress = 'sedang_belajar'
  } else {
    // Post-test
    if (isLolos) {
      statusProgress = 'selesai'
    } else {
      statusProgress = 'sedang_belajar'
      if (currentAttempts >= maxAttempts) {
        mustRepeat = true
        statusProgress = 'belum_mulai' // Reset jika gagal 3x post-test
      }
    }
  }

  await prisma.user_progress.upsert({
    where: {
      userId_moduleId: {
        userId,
        moduleId: evaluationAda.moduleId
      }
    },
    update: {
      ...(!isPreTest && { skor }), // Hanya update skor utama jika post-test
      status: statusProgress,
      attempts: mustRepeat ? 0 : currentAttempts,
      completedAt: isLolos && !isPreTest ? new Date() : null
    },
    create: {
      userId,
      moduleId: evaluationAda.moduleId,
      skor: isPreTest ? 0 : skor,
      status: statusProgress,
      attempts: mustRepeat ? 0 : currentAttempts,
      completedAt: isLolos && !isPreTest ? new Date() : null
    }
  })

  // 4. Return Pesan Response Dinamis
  let pesan = ''
  if (isPreTest) {
    pesan = `Pre-Test selesai! Skor awal kamu: ${skor}. Silakan lanjut ke materi modul.`
  } else if (isLolos) {
    pesan = 'Selamat! Kamu lulus Post-Test modul ini.'
  } else if (mustRepeat) {
    pesan = `Kamu telah gagal Post-Test ${maxAttempts}x. Status modul di-reset ke awal.`
  } else {
    pesan = `Nilai Post-Test (${skor}) belum mencapai passing grade (${passingScore}%). Sisa percobaan: ${maxAttempts - currentAttempts}`
  }

  return {
    tipeEvaluasi: evaluationAda.tipe,
    totalSoal,
    benar: totalBenar,
    salah: totalSoal - totalBenar,
    skor,
    passingScore,
    isLolos,
    percobaanKe: currentAttempts,
    sisaPercobaan: Math.max(0, maxAttempts - currentAttempts),
    mustRepeat,
    pesan
  }
}

// ================================================
// GET ANSWERS (Admin)
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
              isCorrect: true
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
// GET MY ANSWERS (Guru)
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
    tipeEvaluasi: evaluationAda.tipe,
    skor: total > 0 ? Math.round((benar / total) * 100) : 0,
    benar,
    totalSoal: total,
    jawaban: answers
  }
}

// ================================================
// UPDATE QUESTION & OPTIONS
// ================================================
const updateQuestion = async (questionId, data) => {
  const { pertanyaan, options } = data

  const questionAda = await prisma.question.findUnique({
    where: { id: questionId }
  })

  if (!questionAda) {
    throw new Error('Soal tidak ditemukan')
  }

  if (options) {
    if (options.length < 2) {
      throw new Error('Soal pilihan ganda harus memiliki minimal 2 pilihan jawaban')
    }
    const adaJawabanBenar = options.some(opt => opt.isCorrect === true)
    if (!adaJawabanBenar) {
      throw new Error('Harus ada minimal 1 jawaban yang benar')
    }
  }

  const updatedQuestion = await prisma.$transaction(async (tx) => {
    if (options) {
      await tx.option.deleteMany({
        where: { questionId }
      })
    }

    return await tx.question.update({
      where: { id: questionId },
      data: {
        pertanyaan: pertanyaan || questionAda.pertanyaan,
        ...(options && {
          options: {
            create: options.map(opt => ({
              teksOpsi: opt.teksOpsi,
              isCorrect: opt.isCorrect || false
            }))
          }
        })
      },
      include: { options: true }
    })
  })

  return updatedQuestion
}

// ================================================
// DELETE QUESTION
// ================================================
const deleteQuestion = async (questionId) => {
  const questionAda = await prisma.question.findUnique({
    where: { id: questionId }
  })

  if (!questionAda) {
    throw new Error('Soal tidak ditemukan')
  }

  await prisma.question.delete({
    where: { id: questionId }
  })

  return { pesan: 'Soal berhasil dihapus' }
}

module.exports = {
  getEvaluationsByModule,
  getEvaluationById,
  createEvaluation,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitJawaban,
  getAnswersByEvaluation,
  getMyAnswers 
}