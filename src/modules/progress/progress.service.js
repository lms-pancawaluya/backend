// src/modules/progress/progress.service.js

const prisma = require('../../config/database')

// ================================================
// HELPER — Hitung status completion PER TAHAP
// (Pre-Test -> Learning Material -> Post-Test)
//
// Semua status diturunkan dari data EXISTING (tanpa tabel/kolom baru):
// - preTestCompleted  : module tidak punya pre-test ATAU guru sudah
//                       submit pre-test (ada user_answers pada evaluasi
//                       bertipe pre_test di module ini).
// - materialCompleted : module tidak punya mini-quiz ATAU seluruh mini-quiz
//                       pada materi module ini sudah lulus (MiniQuizAttempt
//                       dengan isLolos = true). Konsisten dengan aturan
//                       auto-complete yang dipakai mini-quiz.service.
// - postTestCompleted : module tidak punya post-test ATAU skor utama guru
//                       (user_progress.skor) sudah >= passingScore post-test.
//
// Status dihitung per GURU (userId) per MODULE.
// ================================================
const hitungStageCompletion = async (userId, moduleIds) => {
  const map = {}
  if (!moduleIds || moduleIds.length === 0) {
    return map
  }

  // 1. Ambil semua evaluasi (pre-test/post-test) pada modul-modul terkait
  const evaluations = await prisma.evaluation.findMany({
    where: { moduleId: { in: moduleIds } },
    select: {
      id: true,
      moduleId: true,
      tipe: true,
      passingScore: true,
      questions: { select: { id: true } }
    }
  })

  // 2. Ambil jawaban guru (user_answers) hanya untuk soal pada evaluasi modul tsb
  const evaluationIds = evaluations.map((e) => e.id)
  const answers = evaluationIds.length > 0
    ? await prisma.user_answers.findMany({
        where: {
          userId,
          question: { evaluationId: { in: evaluationIds } }
        },
        select: { question: { select: { evaluationId: true } } }
      })
    : []

  // Set evaluationId yang sudah punya minimal 1 jawaban dari guru ini
  const evaluationDijawab = new Set(
    answers.map((a) => a.question?.evaluationId).filter(Boolean)
  )

  // 3. Ambil seluruh mini-quiz pada semua content di modul-modul terkait,
  //    beserta percobaan LULUS milik guru ini
  const contents = await prisma.content.findMany({
    where: { moduleId: { in: moduleIds } },
    select: {
      moduleId: true,
      miniQuizzes: {
        select: {
          id: true,
          attempts: {
            where: { userId, isLolos: true },
            select: { id: true }
          }
        }
      }
    }
  })

  // 4. Ambil progress guru (untuk skor post-test) pada modul-modul terkait
  const progress = await prisma.user_progress.findMany({
    where: { userId, moduleId: { in: moduleIds } },
    select: { moduleId: true, skor: true }
  })
  const skorMap = {}
  progress.forEach((p) => { skorMap[p.moduleId] = p.skor ?? 0 })

  // 5. Bangun status per module
  moduleIds.forEach((moduleId) => {
    const modulEvaluations = evaluations.filter((e) => e.moduleId === moduleId)
    const preTest = modulEvaluations.find((e) => e.tipe === 'pre_test') || null
    const postTest = modulEvaluations.find((e) => e.tipe === 'post_test') || null

    // Pre-Test: tidak ada pre-test => dianggap tidak diperlukan (true)
    const preTestCompleted = !preTest || evaluationDijawab.has(preTest.id)

    // Material: kumpulan mini-quiz di modul ini
    const modulMiniQuizzes = contents
      .filter((c) => c.moduleId === moduleId)
      .flatMap((c) => c.miniQuizzes)

    // Tidak ada mini-quiz => material tidak diperlukan (true)
    const materialCompleted = modulMiniQuizzes.length === 0
      ? true
      : modulMiniQuizzes.every((q) => q.attempts.length > 0)

    // Post-Test: tidak ada post-test => dianggap tidak diperlukan (true)
    const passingScore = postTest?.passingScore ?? 80
    const postTestCompleted = !postTest
      ? true
      : (skorMap[moduleId] ?? 0) >= passingScore

    map[moduleId] = {
      preTestCompleted,
      materialCompleted,
      postTestCompleted
    }
  })

  return map
}

// ================================================
// GET PROGRESS — Ambil semua progress guru
// ================================================
const getProgress = async (userId) => {
  const progress = await prisma.user_progress.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      module: {
        select: {
          id: true,
          judul: true,
          aspekPancawaluya: true,
          urutan: true,
          _count: {
            select: { contents: true, evaluations: true }
          }
        }
      }
    },
    orderBy: {
      module: { urutan: 'asc' }
    }
  })

  // Hitung status per tahap (Pre-Test -> Material -> Post-Test) dari data existing
  const moduleIds = progress.map((p) => p.module?.id).filter(Boolean)
  const stageMap = await hitungStageCompletion(userId, moduleIds)

  return progress.map((p) => {
    const stage = stageMap[p.module?.id] || {
      preTestCompleted: false,
      materialCompleted: false,
      postTestCompleted: false
    }

    // Pertahankan seluruh field lama, tambahkan field stage tanpa menghapus apa pun
    return {
      ...p,
      preTestCompleted: stage.preTestCompleted,
      materialCompleted: stage.materialCompleted,
      postTestCompleted: stage.postTestCompleted
    }
  })
}

// ================================================
// GET SUMMARY — Ringkasan progress semua modul (FIXED)
// ================================================
const getSummary = async (userId) => {
  // 1. Ambil semua modul yang ada
  const allModules = await prisma.module.findMany({
    select: {
      id: true,
      judul: true,
      aspekPancawaluya: true,
      urutan: true
    },
    orderBy: { urutan: 'asc' }
  })

  // 2. Ambil progress guru untuk semua modul
  const userProgress = await prisma.user_progress.findMany({
    where: { userId },
    select: {
      moduleId: true,
      status: true,
      completedAt: true
    }
  })

  // 3. Gabungkan data modul dengan progress guru
  const summary = allModules.map(module => {
    const progress = userProgress.find(p => p.moduleId === module.id)

    return {
      ...module,
      status: progress?.status || 'belum_mulai',
      completedAt: progress?.completedAt || null
    }
  })

  // 4. Hitung statistik persentase keseluruhan
  const totalModul = allModules.length
  const selesai = userProgress.filter(p => p.status === 'selesai').length
  const sedangBelajar = userProgress.filter(p => p.status === 'sedang_belajar').length
  const belumMulai = totalModul - selesai - sedangBelajar

  return {
    statistik: {
      totalModul,
      selesai,
      sedangBelajar,
      belumMulai,
      persentaseSelesai: totalModul > 0
        ? Math.round((selesai / totalModul) * 100)
        : 0
    },
    modul: summary
  }
}

// ================================================
// START MODULE — Mulai belajar modul (FIXED LOGIC)
// ================================================
const startModule = async (userId, moduleId) => {
  // Cek apakah modul ada
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // Cek status progress yang ada saat ini
  const existingProgress = await prisma.user_progress.findUnique({
    where: {
      userId_moduleId: { userId, moduleId }
    }
  })

  // Jika sudah 'selesai', JANGAN diubah kembali ke 'sedang_belajar'
  if (existingProgress && existingProgress.status === 'selesai') {
    return existingProgress
  }

  // Jika belum ada atau statusnya belum_mulai, set ke sedang_belajar
  const progress = await prisma.user_progress.upsert({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    update: {
      status: 'sedang_belajar'
    },
    create: {
      userId,
      moduleId,
      status: 'sedang_belajar'
    }
  })

  return progress
}

// ================================================
// COMPLETE MODULE — Tandai modul selesai (FIXED LOGIC)
// ================================================
const completeModule = async (userId, moduleId) => {
  // Cek modul
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // Set atau update status menjadi selesai
  const progress = await prisma.user_progress.upsert({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    update: {
      status: 'selesai',
      completedAt: new Date()
    },
    create: {
      userId,
      moduleId,
      status: 'selesai',
      completedAt: new Date()
    }
  })

  return progress
}

// ================================================
// GET PROGRESS BY MODULE — Cek progress satu modul
// ================================================
const getProgressByModule = async (userId, moduleId) => {
  const progress = await prisma.user_progress.findUnique({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      module: {
        select: {
          id: true,
          judul: true,
          aspekPancawaluya: true
        }
      }
    }
  })

  // Hitung status per tahap untuk modul ini (data existing, per guru per modul)
  const stageMap = await hitungStageCompletion(userId, [moduleId])
  const stage = stageMap[moduleId] || {
    preTestCompleted: false,
    materialCompleted: false,
    postTestCompleted: false
  }

  if (!progress) {
    return {
      status: 'belum_mulai',
      completedAt: null,
      preTestCompleted: stage.preTestCompleted,
      materialCompleted: stage.materialCompleted,
      postTestCompleted: stage.postTestCompleted
    }
  }

  return {
    ...progress,
    preTestCompleted: stage.preTestCompleted,
    materialCompleted: stage.materialCompleted,
    postTestCompleted: stage.postTestCompleted
  }
}

module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule,
  getProgressByModule
}