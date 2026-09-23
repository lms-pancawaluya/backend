// src/shared/assessment.helpers.js
//
// Helper bersama untuk domain Pre-Test & Post-Test.
// Prisma schema saat ini sudah memakai model PreTest dan PostTest terpisah.
// Helper ini mempertahankan behavior scoring/progress existing, sambil
// menambahkan field `tipe` sintetis pada response agar contract API lama
// tetap stabil.

const prisma = require('../config/database')

// ================================================
// ASSESSMENT DOMAIN CONSTANTS
// ================================================
const ASSESSMENT_TYPE = {
  PRE_TEST: 'pre_test',
  POST_TEST: 'post_test'
}

const DEFAULT_PASSING_SCORE_POST_TEST = 80
const DEFAULT_MAX_ATTEMPTS_POST_TEST = 3
const PASSING_SCORE_PRE_TEST = 0
const MAX_ATTEMPTS_PRE_TEST = 1

// ================================================
// TYPE HELPERS
// ================================================
const isPreTestType = (tipe) => tipe === ASSESSMENT_TYPE.PRE_TEST
const isPostTestType = (tipe) => tipe === ASSESSMENT_TYPE.POST_TEST

const getAssessmentDelegate = (tipe, client = prisma) => {
  if (isPreTestType(tipe)) return client.preTest
  if (isPostTestType(tipe)) return client.postTest
  throw new Error('Tipe assessment tidak valid')
}

const getQuestionAssessmentField = (tipe) => {
  if (isPreTestType(tipe)) return 'preTestId'
  if (isPostTestType(tipe)) return 'postTestId'
  throw new Error('Tipe assessment tidak valid')
}

const attachType = (assessment, tipe) => {
  if (!assessment) return assessment
  return {
    ...assessment,
    tipe
  }
}

const resolveSubmitDefaults = (assessment) => {
  if (isPreTestType(assessment.tipe)) {
    return {
      passingScore: PASSING_SCORE_PRE_TEST,
      maxAttempts: MAX_ATTEMPTS_PRE_TEST
    }
  }

  return {
    passingScore: assessment.passingScore || DEFAULT_PASSING_SCORE_POST_TEST,
    maxAttempts: assessment.maxAttempts || DEFAULT_MAX_ATTEMPTS_POST_TEST
  }
}

// Helper internal untuk menoleransi variasi nama field dari FE
const mapOptionsPayload = (options) => {
  if (!options || !Array.isArray(options)) return []
  return options.map(opt => ({
    teksOpsi: opt.teksOpsi || opt.teks || opt.text || opt.label || opt.optionText || '',
    isCorrect: Boolean(opt.isCorrect || opt.is_correct)
  }))
}

// ================================================
// MODULE / ASSESSMENT LOOKUPS (shared)
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

const getAssessmentInModule = async (moduleId, assessmentId, tipe) => {
  const delegate = getAssessmentDelegate(tipe)
  const assessmentAda = await delegate.findUnique({
    where: { id: assessmentId }
  })

  if (!assessmentAda) {
    const error = new Error('Evaluasi tidak ditemukan')
    error.statusCode = 404
    throw error
  }

  if (assessmentAda.moduleId !== moduleId) {
    const error = new Error('Evaluasi ini bukan milik modul tersebut')
    error.statusCode = 400
    throw error
  }

  return attachType(assessmentAda, tipe)
}

// ================================================
// GET ASSESSMENT BY ID + SOAL PG
// ================================================
const getAssessmentById = async (id, tipe) => {
  const delegate = getAssessmentDelegate(tipe)
  const assessment = await delegate.findUnique({
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
          options: {
            select: {
              id: true,
              teksOpsi: true,
              isCorrect: true
            }
          }
        }
      }
    }
  })

  if (!assessment) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  return attachType(assessment, tipe)
}

// ================================================
// CREATE ASSESSMENT (Pre-Test / Post-Test)
// ================================================
const createAssessment = async (moduleId, tipe, data) => {
  const { judul, passingScore, maxAttempts } = data

  await assertModuleExists(moduleId)

  const isPreTest = isPreTestType(tipe)
  const delegate = getAssessmentDelegate(tipe)

  const assessmentBaru = await delegate.create({
    data: {
      moduleId,
      judul,
      passingScore: isPreTest
        ? PASSING_SCORE_PRE_TEST
        : (passingScore || DEFAULT_PASSING_SCORE_POST_TEST),
      maxAttempts: isPreTest
        ? MAX_ATTEMPTS_PRE_TEST
        : (maxAttempts || DEFAULT_MAX_ATTEMPTS_POST_TEST)
    }
  })

  return attachType(assessmentBaru, tipe)
}

// ================================================
// QUESTION + OPTIONS (Murni PG)
// ================================================
const createQuestion = async (assessmentId, tipe, data) => {
  const { pertanyaan, options } = data
  const delegate = getAssessmentDelegate(tipe)

  const assessmentAda = await delegate.findUnique({
    where: { id: assessmentId }
  })

  if (!assessmentAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  if (!options || options.length < 2) {
    throw new Error('Soal pilihan ganda harus memiliki minimal 2 pilihan jawaban')
  }

  const formattedOptions = mapOptionsPayload(options)

  const adaJawabanBenar = formattedOptions.some(opt => opt.isCorrect === true)
  if (!adaJawabanBenar) {
    throw new Error('Harus ada minimal 1 jawaban yang benar')
  }

  const assessmentField = getQuestionAssessmentField(tipe)
  const questionBaru = await prisma.question.create({
    data: {
      [assessmentField]: assessmentId,
      pertanyaan,
      tipe: 'pilihan_ganda',
      options: {
        create: formattedOptions
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

  let formattedOptions = null
  if (options) {
    if (options.length < 2) {
      throw new Error('Soal pilihan ganda harus memiliki minimal 2 pilihan jawaban')
    }

    formattedOptions = mapOptionsPayload(options)

    const adaJawabanBenar = formattedOptions.some(opt => opt.isCorrect === true)
    if (!adaJawabanBenar) {
      throw new Error('Harus ada minimal 1 jawaban yang benar')
    }
  }

  const updatedQuestion = await prisma.$transaction(async (tx) => {
    if (formattedOptions) {
      await tx.option.deleteMany({
        where: { questionId }
      })
    }

    return await tx.question.update({
      where: { id: questionId },
      data: {
        pertanyaan: pertanyaan || questionAda.pertanyaan,
        ...(formattedOptions && {
          options: {
            create: formattedOptions
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
// SUBMIT JAWABAN - Auto-Grading
// ================================================
const submitJawaban = async (assessmentId, tipe, userId, data) => {
  const { jawaban } = data
  const delegate = getAssessmentDelegate(tipe)

  const assessmentAda = await delegate.findUnique({
    where: { id: assessmentId },
    include: {
      questions: {
        include: { options: true }
      }
    }
  })

  if (!assessmentAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const assessment = attachType(assessmentAda, tipe)
  const totalSoal = assessment.questions.length
  if (totalSoal === 0) {
    throw new Error('Evaluasi ini belum memiliki soal')
  }

  let totalBenar = 0

  await Promise.all(
    jawaban.map(async (item) => {
      const question = assessment.questions.find(
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

  const skor = Math.round((totalBenar / totalSoal) * 100)
  const isPreTest = isPreTestType(assessment.tipe)
  const { passingScore, maxAttempts } = resolveSubmitDefaults(assessment)
  const isLolos = skor >= passingScore

  let progress = await prisma.user_progress.findUnique({
    where: {
      userId_moduleId: {
        userId,
        moduleId: assessment.moduleId
      }
    }
  })

  let currentAttempts = (progress?.attempts || 0) + 1
  let mustRepeat = false
  let statusProgress = progress?.status || 'belum_mulai'

  if (isPreTest) {
    statusProgress = 'sedang_belajar'
  } else {
    if (isLolos) {
      statusProgress = 'selesai'
    } else {
      statusProgress = 'sedang_belajar'
      if (currentAttempts >= maxAttempts) {
        mustRepeat = true
        statusProgress = 'belum_mulai'
      }
    }
  }

  await prisma.user_progress.upsert({
    where: {
      userId_moduleId: {
        userId,
        moduleId: assessment.moduleId
      }
    },
    update: {
      ...(!isPreTest && { skor }),
      status: statusProgress,
      attempts: mustRepeat ? 0 : currentAttempts,
      completedAt: isLolos && !isPreTest ? new Date() : null
    },
    create: {
      userId,
      moduleId: assessment.moduleId,
      skor: isPreTest ? 0 : skor,
      status: statusProgress,
      attempts: mustRepeat ? 0 : currentAttempts,
      completedAt: isLolos && !isPreTest ? new Date() : null
    }
  })

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
    tipeEvaluasi: assessment.tipe,
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
const getAnswersByAssessment = async (assessmentId, tipe) => {
  const delegate = getAssessmentDelegate(tipe)
  const assessmentAda = await delegate.findUnique({
    where: { id: assessmentId }
  })

  if (!assessmentAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const assessmentField = getQuestionAssessmentField(tipe)
  const answers = await prisma.user_answers.findMany({
    where: {
      question: { [assessmentField]: assessmentId }
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
const getMyAnswers = async (assessmentId, tipe, userId) => {
  const delegate = getAssessmentDelegate(tipe)
  const assessmentAda = await delegate.findUnique({
    where: { id: assessmentId }
  })

  if (!assessmentAda) {
    throw new Error('Evaluasi tidak ditemukan')
  }

  const assessmentField = getQuestionAssessmentField(tipe)
  const answers = await prisma.user_answers.findMany({
    where: {
      userId,
      question: { [assessmentField]: assessmentId }
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
    tipeEvaluasi: tipe,
    skor: total > 0 ? Math.round((benar / total) * 100) : 0,
    benar,
    totalSoal: total,
    jawaban: answers
  }
}

// ================================================
// DELETE ASSESSMENT (Pre-Test / Post-Test)
// ================================================
const deleteAssessment = async (moduleId, assessmentId, tipe) => {
  const assessmentAda = await getAssessmentInModule(moduleId, assessmentId, tipe)
  const delegate = getAssessmentDelegate(tipe)

  await delegate.delete({
    where: { id: assessmentAda.id }
  })

  const isPreTest = isPreTestType(assessmentAda.tipe)
  return {
    pesan: isPreTest ? 'Pre-Test berhasil dihapus' : 'Post-Test berhasil dihapus'
  }
}

module.exports = {
  ASSESSMENT_TYPE,
  isPreTestType,
  isPostTestType,
  getAssessmentDelegate,
  getQuestionAssessmentField,
  attachType,
  resolveSubmitDefaults,
  assertModuleExists,
  getAssessmentInModule,
  getAssessmentById,
  createAssessment,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  submitJawaban,
  getAnswersByAssessment,
  getMyAnswers,
  deleteAssessment
}