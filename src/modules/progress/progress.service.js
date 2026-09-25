// src/modules/progress/progress.service.js

const prisma = require('../../config/database')

// ================================================
// HELPER — Hitung status completion PER TAHAP
// (Pre-Test -> Learning Material -> Post-Test)
// ================================================
const hitungStageCompletion = async (userId, moduleIds) => {
  const map = {}

  if (!moduleIds || moduleIds.length === 0) {
    return map
  }

  // 1. Ambil semua assessment (pre-test/post-test)
  const [preTests, postTests] = await Promise.all([
    prisma.preTest.findMany({
      where: { moduleId: { in: moduleIds } },
      select: {
        id: true,
        moduleId: true,
        passingScore: true,
        questions: { select: { id: true } }
      }
    }),
    prisma.postTest.findMany({
      where: { moduleId: { in: moduleIds } },
      select: {
        id: true,
        moduleId: true,
        passingScore: true,
        questions: { select: { id: true } }
      }
    })
  ])

  const assessments = [
    ...preTests.map((preTest) => ({ ...preTest, tipe: 'pre_test' })),
    ...postTests.map((postTest) => ({ ...postTest, tipe: 'post_test' }))
  ]

  const validPreTestIds = preTests
    .filter((pt) => pt.questions && pt.questions.length > 0)
    .map((pt) => pt.id)

  const validPostTestIds = postTests
    .filter((pt) => pt.questions && pt.questions.length > 0)
    .map((pt) => pt.id)

  // 2. Ambil jawaban guru untuk assessment valid
  const assessmentFilters = []

  if (validPreTestIds.length > 0) {
    assessmentFilters.push({
      question: { preTestId: { in: validPreTestIds } }
    })
  }

  if (validPostTestIds.length > 0) {
    assessmentFilters.push({
      question: { postTestId: { in: validPostTestIds } }
    })
  }

  const answers =
    assessmentFilters.length > 0
      ? await prisma.user_answers.findMany({
          where: {
            userId,
            OR: assessmentFilters
          },
          select: {
            question: {
              select: {
                preTestId: true,
                postTestId: true
              }
            }
          }
        })
      : []

  const assessmentDijawab = new Set(
    answers
      .map((answer) => answer.question?.preTestId || answer.question?.postTestId)
      .filter(Boolean)
  )

  // 3. Ambil seluruh content pada module
  const contents = await prisma.content.findMany({
    where: { moduleId: { in: moduleIds } },
    select: {
      id: true,
      moduleId: true,
      tipe: true,
      miniQuizzes: {
        select: {
          id: true,
          attempts: {
            where: { userId, isLolos: true },
            select: { id: true }
          }
        }
      },
      userProgress: {
        where: { userId },
        select: {
          progress: true,
          isCompleted: true,
          completedAt: true
        }
      }
    }
  })

  // 4. Ambil progress guru untuk skor post-test
  const progress = await prisma.user_progress.findMany({
    where: {
      userId,
      moduleId: { in: moduleIds }
    },
    select: {
      moduleId: true,
      skor: true
    }
  })

  const skorMap = {}
  progress.forEach((item) => {
    skorMap[item.moduleId] = item.skor ?? 0
  })

  // 5. Bangun status setiap module
  moduleIds.forEach((moduleId) => {
    const moduleAssessments = assessments.filter(
      (assessment) => assessment.moduleId === moduleId
    )

    const preTest =
      moduleAssessments.find((assessment) => assessment.tipe === 'pre_test') || null

    const postTest =
      moduleAssessments.find((assessment) => assessment.tipe === 'post_test') || null

    const modulContents = contents.filter(
      (content) => content.moduleId === moduleId
    )

    const totalContents = modulContents.length
    const isModulKosong = !preTest && !postTest && totalContents === 0

    // PRE-TEST
    let preTestCompleted = false
    if (!isModulKosong) {
      if (preTest) {
        preTestCompleted =
          preTest.questions.length === 0 || assessmentDijawab.has(preTest.id)
      } else {
        preTestCompleted = true
      }
    }

    // MATERIAL
    let completedContents = 0
    const materialDetail = modulContents.map((content) => {
      const adaMiniQuiz = content.miniQuizzes.length > 0
      const contentProg = content.userProgress[0] || null

      let progressSelesai = false
      if (contentProg) {
        if (content.tipe === 'video') {
          progressSelesai =
            contentProg.isCompleted === true || (contentProg.progress ?? 0) >= 100
        } else {
          progressSelesai = contentProg.isCompleted === true
        }
      }

      let miniQuizLulus = true
      if (adaMiniQuiz) {
        miniQuizLulus = content.miniQuizzes.every(
          (miniQuiz) => miniQuiz.attempts.length > 0
        )
      }

      const isCompleted = adaMiniQuiz
        ? progressSelesai && miniQuizLulus
        : progressSelesai

      if (isCompleted) {
        completedContents++
      }

      return {
        contentId: content.id,
        tipe: content.tipe,
        hasMiniQuiz: adaMiniQuiz,
        isCompleted,
        progressPercent: contentProg?.progress ?? 0
      }
    })

    const materialCompleted =
      !isModulKosong && totalContents > 0
        ? completedContents === totalContents
        : !isModulKosong && totalContents === 0

    // POST-TEST
    const passingScore = postTest?.passingScore ?? 80
    let postTestCompleted = false

    if (!isModulKosong) {
      if (postTest) {
        postTestCompleted = (skorMap[moduleId] ?? 0) >= passingScore
      } else {
        postTestCompleted = materialCompleted
      }
    }

    map[moduleId] = {
      preTestCompleted,
      materialCompleted,
      postTestCompleted,
      materialProgress: {
        total: totalContents,
        completed: completedContents
      },
      materialDetail
    }
  })

  return map
}

// ================================================
// GET PROGRESS — Ambil semua progress guru
// ================================================
const getProgress = async (userId) => {
  const allModules = await prisma.module.findMany({
    select: {
      id: true,
      judul: true,
      aspekPancawaluya: true,
      urutan: true,
      _count: {
        select: {
          contents: true,
          preTests: true,
          postTests: true
        }
      }
    },
    orderBy: { urutan: 'asc' } // Perbaikan BUG orderBy
  })

  const userProgress = await prisma.user_progress.findMany({
    where: { userId },
    select: {
      id: true,
      moduleId: true,
      status: true,
      completedAt: true
    }
  })

  const moduleIds = allModules.map((item) => item.id)
  const stageMap = await hitungStageCompletion(userId, moduleIds)

  return allModules.map((module) => {
    const prog = userProgress.find((p) => p.moduleId === module.id)
    const stage = stageMap[module.id] || {
      preTestCompleted: false,
      materialCompleted: false,
      postTestCompleted: false,
      materialProgress: { total: 0, completed: 0 },
      materialDetail: []
    }

    const count = module._count
    const normalizedModule = {
      ...module,
      _count: {
        ...count,
        evaluations: (count?.preTests || 0) + (count?.postTests || 0)
      }
    }

    return {
      id: prog?.id || null,
      status: prog?.status || 'belum_mulai',
      completedAt: prog?.completedAt || null,
      module: normalizedModule,
      preTestCompleted: stage.preTestCompleted,
      materialCompleted: stage.materialCompleted,
      postTestCompleted: stage.postTestCompleted,
      materialProgress: stage.materialProgress,
      materialDetail: stage.materialDetail
    }
  })
}

// ================================================
// GET SUMMARY — Ringkasan progress semua modul
// ================================================
const getSummary = async (userId) => {
  const allModules = await prisma.module.findMany({
    select: { id: true, judul: true, aspekPancawaluya: true, urutan: true },
    orderBy: { urutan: 'asc' }
  })

  const userProgress = await prisma.user_progress.findMany({
    where: { userId },
    select: { moduleId: true, status: true, completedAt: true }
  })

  const summary = allModules.map((module) => {
    const progress = userProgress.find((item) => item.moduleId === module.id)
    return {
      ...module,
      status: progress?.status || 'belum_mulai',
      completedAt: progress?.completedAt || null
    }
  })

  const totalModul = allModules.length
  const selesai = userProgress.filter((item) => item.status === 'selesai').length
  const sedangBelajar = userProgress.filter((item) => item.status === 'sedang_belajar').length
  const belumMulai = totalModul - selesai - sedangBelajar

  return {
    statistik: {
      totalModul,
      selesai,
      sedangBelajar,
      belumMulai,
      persentaseSelesai:
        totalModul > 0 ? Math.round((selesai / totalModul) * 100) : 0
    },
    modul: summary
  }
}

// ================================================
// START MODULE
// ================================================
const startModule = async (userId, moduleId) => {
  const moduleAda = await prisma.module.findUnique({ where: { id: moduleId } })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const existingProgress = await prisma.user_progress.findUnique({
    where: { userId_moduleId: { userId, moduleId } }
  })

  if (existingProgress && existingProgress.status === 'selesai') {
    return existingProgress
  }

  return await prisma.user_progress.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    update: { status: 'sedang_belajar' },
    create: { userId, moduleId, status: 'sedang_belajar' }
  })
}

// ================================================
// COMPLETE MODULE
// ================================================
const completeModule = async (userId, moduleId) => {
  const moduleAda = await prisma.module.findUnique({ where: { id: moduleId } })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const now = new Date()

  return await prisma.user_progress.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    update: { status: 'selesai', completedAt: now },
    create: { userId, moduleId, status: 'selesai', completedAt: now }
  })
}

// ================================================
// GET PROGRESS BY MODULE
// ================================================
const getProgressByModule = async (userId, moduleId) => {
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, judul: true, aspekPancawaluya: true }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const progress = await prisma.user_progress.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: {
      id: true,
      status: true,
      completedAt: true,
      module: {
        select: { id: true, judul: true, aspekPancawaluya: true }
      }
    }
  })

  const stageMap = await hitungStageCompletion(userId, [moduleId])
  const stage = stageMap[moduleId] || {
    preTestCompleted: false,
    materialCompleted: false,
    postTestCompleted: false,
    materialProgress: { total: 0, completed: 0 },
    materialDetail: []
  }

  if (!progress) {
    return {
      id: null,
      status: 'belum_mulai',
      completedAt: null,
      module: moduleAda,
      ...stage
    }
  }

  return {
    ...progress,
    ...stage
  }
}

// ================================================
// MARK CONTENT COMPLETE
// ================================================
const markContentComplete = async (userId, contentId) => {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, tipe: true, moduleId: true }
  })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  if (content.tipe === 'video') {
    const existing = await prisma.userContentProgress.findUnique({
      where: { userId_contentId: { userId, contentId } }
    })

    const percent = existing?.progress ?? 0
    if (percent < 100) {
      throw new Error('Video belum selesai ditonton 100%')
    }
  }

  const now = new Date()
  const saved = await prisma.userContentProgress.upsert({
    where: { userId_contentId: { userId, contentId } },
    update: { isCompleted: true, progress: 100, completedAt: now },
    create: { userId, contentId, isCompleted: true, progress: 100, completedAt: now }
  })

  return {
    contentId,
    tipe: content.tipe,
    progressPercent: saved.progress,
    isCompleted: saved.isCompleted,
    completedAt: saved.completedAt
  }
}

// ================================================
// UPDATE CONTENT PROGRESS
// ================================================
const updateContentProgress = async (userId, contentId, progressPercent) => {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, tipe: true, moduleId: true }
  })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  const nilai = Number(progressPercent)

  if (!Number.isFinite(nilai) || !Number.isInteger(nilai) || nilai < 0 || nilai > 100) {
    throw new Error('Progress harus berupa angka bulat 0-100')
  }

  const existing = await prisma.userContentProgress.findUnique({
    where: { userId_contentId: { userId, contentId } }
  })

  const currentPercent = existing?.progress ?? 0
  const nilaiFinal = Math.max(currentPercent, nilai)
  const isCompleted = (existing?.isCompleted === true) || nilaiFinal >= 100
  let completedAt = existing?.completedAt ?? null

  if (isCompleted && !completedAt) {
    completedAt = new Date()
  }

  const saved = await prisma.userContentProgress.upsert({
    where: { userId_contentId: { userId, contentId } },
    update: { progress: nilaiFinal, isCompleted, completedAt },
    create: { userId, contentId, progress: nilaiFinal, isCompleted, completedAt }
  })

  return {
    contentId,
    tipe: content.tipe,
    progressPercent: saved.progress,
    isCompleted: saved.isCompleted,
    completedAt: saved.completedAt
  }
}

module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule,
  getProgressByModule,
  markContentComplete,
  updateContentProgress,
  hitungStageCompletion
}