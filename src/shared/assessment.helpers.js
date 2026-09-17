// src/shared/assessment.helpers.js
//
// Helper bersama untuk domain Pre-Test & Post-Test.
//
// CATATAN PENTING:
// Prisma/database MASIH memakai model `Evaluation` dengan field `tipe`
// sebagai compatibility layer internal:
//   "pre_test"  -> Pre-Test
//   "post_test" -> Post-Test
// Ini SENGAJA. Pemisahan tabel/model akan dilakukan pada task manual
// berikutnya bersama developer. Helper ini TIDAK mengubah schema apa pun.
//
// Semua business logic (scoring, passing score, max attempts, mustRepeat,
// progress, question/option/answer) DIPINDAH apa adanya dari module
// evaluasi lama — tidak ada perubahan perilaku.
//
// Lokasi: src/shared/ — dipakai bersama oleh pre-tests/ dan post-tests/.
// (Dipindah dari src/modules/evaluations/evaluation.helpers.js saat legacy
// module dihapus.)

const prisma = require('../config/database')

// ================================================
// ASSESSMENT DOMAIN CONSTANTS
// ================================================
const ASSESSMENT_TYPE = {
  PRE_TEST: 'pre_test',
  POST_TEST: 'post_test'
}

// Nilai default business rule (dipertahankan persis seperti semula)
const DEFAULT_PASSING_SCORE_POST_TEST = 80
const DEFAULT_MAX_ATTEMPTS_POST_TEST = 3
const PASSING_SCORE_PRE_TEST = 0
const MAX_ATTEMPTS_PRE_TEST = 1

// ================================================
// TYPE HELPERS
// ================================================
const isPreTestType = (tipe) => tipe === ASSESSMENT_TYPE.PRE_TEST

// Resolusi business rule saat submit (dari data evaluation existing).
const resolveSubmitDefaults = (evaluation) => {
  if (isPreTestType(evaluation.tipe)) {
    return {
      passingScore: PASSING_SCORE_PRE_TEST,
      maxAttempts: MAX_ATTEMPTS_PRE_TEST
    }
  }

  return {
    passingScore: evaluation.passingScore || DEFAULT_PASSING_SCORE_POST_TEST,
    maxAttempts: evaluation.maxAttempts || DEFAULT_MAX_ATTEMPTS_POST_TEST
  }
}

// ================================================
// MODULE / EVALUATION LOOKUPS (shared)
// ================================================
const assertModuleExists = async (moduleId) => {
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  return moduleAda
}

// Ambil evaluation milik modul + pastikan tipenya sesuai domain
// (pre_test / post_test). Dipakai oleh endpoint domain-specific agar
// Pre-Test tidak menerima post_test dan sebaliknya.
const getAssessmentInModule = async (moduleId, evaluationId, tipe) => {
  const evaluationAda = await prisma.evaluation.findUnique({
    where: { id: evaluationId }
  })

  if (!evaluationAda) {
    const error = new Error('Evaluasi tidak ditemukan')
    error.statusCode = 404
    throw error
  }

  if (evaluationAda.moduleId !== moduleId) {
    const error = new Error('Evaluasi ini bukan milik modul tersebut')
    error.statusCode = 400
    throw error
  }

  if (evaluationAda.tipe !== tipe) {
    const error = new Error('Tipe evaluasi tidak sesuai dengan endpoint ini')
    error.statusCode = 400
    throw error
  }

  return evaluationAda
}

// ================================================
// GET ASSESSMENT BY ID + SOAL PG
// ================================================
const getAssessmentById = async (id, tipe) => {
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

  // Pastikan assessment yang diminta sesuai tipe domain pemanggil.
  if (tipe && evaluation.tipe !== tipe) {
    throw new Error('Tipe evaluasi tidak sesuai dengan endpoint ini')
  }

  return evaluation
}

// ================================================
// CREATE ASSESSMENT (Pre-Test / Post-Test)
// ================================================
const createAssessment = async (moduleId, tipe, data) => {
  const { judul, passingScore, maxAttempts } = data

  await assertModuleExists(moduleId)

  const isPreTest = isPreTestType(tipe)

  const evaluationBaru = await prisma.evaluation.create({
    data: {
      moduleId,
      judul,
      tipe,
      passingScore: isPreTest
        ? PASSING_SCORE_PRE_TEST
        : (passingScore || DEFAULT_PASSING_SCORE_POST_TEST),
      maxAttempts: isPreTest
        ? MAX_ATTEMPTS_PRE_TEST
        : (maxAttempts || DEFAULT_MAX_ATTEMPTS_POST_TEST)
    }
  })

  return evaluationBaru
}

// ================================================
// QUESTION + OPTIONS (Murni PG)
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

// ================================================
// SUBMIT JAWABAN — Auto-Grading (logic existing, tidak diubah)
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
  const isPreTest = isPreTestType(evaluationAda.tipe)
  const { passingScore, maxAttempts } = resolveSubmitDefaults(evaluationAda)
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
// DELETE ASSESSMENT (Pre-Test / Post-Test)
// ================================================
// Cascade ke questions/options/user_answers ditangani oleh FK existing
// (onDelete: Cascade) — tidak ada cleanup manual & tidak ada perubahan schema.
const deleteAssessment = async (moduleId, evaluationId, tipe) => {
  const evaluationAda = await getAssessmentInModule(moduleId, evaluationId, tipe)

  await prisma.evaluation.delete({
    where: { id: evaluationAda.id }
  })

  const isPreTest = isPreTestType(evaluationAda.tipe)
  return {
    pesan: isPreTest ? 'Pre-Test berhasil dihapus' : 'Post-Test berhasil dihapus'
  }
}

module.exports = {
  ASSESSMENT_TYPE,
  isPreTestType,
  resolveSubmitDefaults,
  assertModuleExists,
  getAssessmentInModule,
  getAssessmentById,
  createAssessment,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitJawaban,
  getAnswersByEvaluation,
  getMyAnswers,
  deleteAssessment
}
