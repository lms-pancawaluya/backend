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
      createdAt: true,
      _count: {
        select: { questions: true }
      }
    }
  })

  return evaluations
}

// ================================================
// GET EVALUATION BY ID + SOAL
// ================================================
const getEvaluationById = async (id) => {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: {
      id: true,
      judul: true,
      moduleId: true,
      createdAt: true,
      questions: {
        select: {
          id: true,
          pertanyaan: true,
          tipe: true,
          // Tampilkan options tapi sembunyikan isCorrect untuk guru
          options: {
            select: {
              id: true,
              teksOpsi: true
              // isCorrect sengaja tidak diambil
              // supaya guru tidak bisa lihat jawaban benar
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
  const { judul } = data

  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const evaluationBaru = await prisma.evaluation.create({
    data: { moduleId, judul }
  })

  return evaluationBaru
}

// ================================================
// CREATE QUESTION + OPTIONS
// ================================================
const createQuestion = async (evaluationId, data) => {
  const { pertanyaan, tipe, options } = data

  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId }
  })

  if (!evaluationAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  // Kalau tipe pilihan_ganda, options wajib ada
  if (tipe === 'pilihan_ganda') {
    if (!options || options.length < 2) {
      throw new Error('Soal pilihan ganda harus memiliki minimal 2 pilihan jawaban')
    }

    // Pastikan ada minimal 1 jawaban benar
    const adaJawabanBenar = options.some(opt => opt.isCorrect === true)
    if (!adaJawabanBenar) {
      throw new Error('Harus ada minimal 1 jawaban yang benar')
    }
  }

  // Buat soal beserta options-nya sekaligus
  const questionBaru = await prisma.question.create({
    data: {
      evaluationId,
      pertanyaan,
      tipe,
      // Kalau pilihan ganda, buat options juga
      options: tipe === 'pilihan_ganda' ? {
        create: options.map(opt => ({
          teksOpsi: opt.teksOpsi,
          isCorrect: opt.isCorrect || false
        }))
      } : undefined
    },
    include: {
      options: true
    }
  })

  return questionBaru
}

// ================================================
// SUBMIT JAWABAN — Guru submit jawaban evaluasi
// ================================================
const submitJawaban = async (evaluationId, userId, data) => {
  const { jawaban } = data
  // jawaban = array: [{ questionId, jawaban }]

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

  // Proses setiap jawaban
  const hasilJawaban = await Promise.all(
    jawaban.map(async (item) => {
      const question = evaluationAda.questions.find(
        q => q.id === item.questionId
      )

      if (!question) {
        throw new Error(`Soal dengan id ${item.questionId} tidak ditemukan`)
      }

      let isCorrect = null

      // Kalau pilihan ganda, cek apakah jawaban benar
      if (question.tipe === 'pilihan_ganda') {
        const pilihanBenar = question.options.find(
          opt => opt.id === item.jawaban && opt.isCorrect
        )
        isCorrect = !!pilihanBenar
      }
      // Kalau esai, isCorrect tetap null (dinilai manual oleh admin)

      // Simpan jawaban ke database
      // Pakai upsert supaya tidak duplikat kalau submit ulang
      const userAnswer = await prisma.user_answers.upsert({
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

      return userAnswer
    })
  )

  // Hitung skor untuk soal pilihan ganda
  const soalPG = hasilJawaban.filter(j => j.isCorrect !== null)
  const benar = soalPG.filter(j => j.isCorrect === true).length
  const totalPG = soalPG.length

  return {
    totalSoal: jawaban.length,
    totalPilihanGanda: totalPG,
    benar,
    skor: totalPG > 0 ? Math.round((benar / totalPG) * 100) : 0,
    pesanEsai: jawaban.length > totalPG
      ? 'Jawaban esai akan dinilai oleh admin'
      : null
  }
}

module.exports = {
  getEvaluationsByModule,
  getEvaluationById,
  createEvaluation,
  createQuestion,
  submitJawaban
}