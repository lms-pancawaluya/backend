// src/modules/progress/progress.service.js

const prisma = require('../../config/database')

// ================================================
// HELPER — Hitung status completion PER TAHAP
// (Pre-Test -> Learning Material -> Post-Test)
//
// Definisi:
// - preTestCompleted:
//   module tidak punya pre-test ATAU guru sudah submit pre-test
//   (ada user_answers pada evaluasi bertipe pre_test di module ini).
//
// - materialCompleted:
//   module tidak punya learning material ATAU SELURUH material pada
//   module sudah memenuhi aturan completion.
//
//   Completion per material:
//   1. Content TANPA mini-quiz:
//      - video  => progressPercent >= 100 ATAU isCompleted = true
//      - teks/pdf/link => isCompleted = true
//
//   2. Content DENGAN mini-quiz:
//      - material/content harus selesai
//      - DAN seluruh mini-quiz harus LULUS
//
//   Jadi mini-quiz saja TIDAK cukup untuk menyelesaikan material.
//
// - postTestCompleted:
//   module tidak punya post-test ATAU skor utama guru
//   (user_progress.skor) sudah >= passingScore post-test.
//
// Catatan:
// - Membuka halaman TIDAK dianggap selesai.
// - Record my-answers TIDAK dianggap selesai untuk material.
// - Material non-mini-quiz hanya selesai bila tercatat eksplisit
//   di user_content_progress.
// - Progress dihitung per GURU (userId) per MODULE.
// ================================================
const hitungStageCompletion = async (userId, moduleIds) => {
  const map = {}

  if (!moduleIds || moduleIds.length === 0) {
    return map
  }

  // ================================================
  // 1. Ambil semua evaluasi (pre-test/post-test)
  // ================================================
  const evaluations = await prisma.evaluation.findMany({
    where: {
      moduleId: {
        in: moduleIds
      }
    },
    select: {
      id: true,
      moduleId: true,
      tipe: true,
      passingScore: true,
      questions: {
        select: {
          id: true
        }
      }
    }
  })

  // ================================================
  // 2. Ambil jawaban guru untuk evaluasi terkait
  // ================================================
  const evaluationIds = evaluations.map((evaluation) => evaluation.id)

  const answers = evaluationIds.length > 0
    ? await prisma.user_answers.findMany({
        where: {
          userId,
          question: {
            evaluationId: {
              in: evaluationIds
            }
          }
        },
        select: {
          question: {
            select: {
              evaluationId: true
            }
          }
        }
      })
    : []

  // Set evaluationId yang sudah memiliki minimal
  // satu jawaban dari guru ini.
  const evaluationDijawab = new Set(
    answers
      .map((answer) => answer.question?.evaluationId)
      .filter(Boolean)
  )

  // ================================================
  // 3. Ambil seluruh content pada module
  //
  // Termasuk:
  // - mini-quiz
  // - attempt mini-quiz yang LULUS
  // - user_content_progress milik guru
  // ================================================
  const contents = await prisma.content.findMany({
    where: {
      moduleId: {
        in: moduleIds
      }
    },
    select: {
      id: true,
      moduleId: true,
      tipe: true,

      miniQuizzes: {
        select: {
          id: true,

          attempts: {
            where: {
              userId,
              isLolos: true
            },
            select: {
              id: true
            }
          }
        }
      },

      contentProgress: {
        where: {
          userId
        },
        select: {
          isCompleted: true,
          progressPercent: true,
          completedAt: true
        }
      }
    }
  })

  // ================================================
  // 4. Ambil progress guru
  // Untuk menentukan skor post-test.
  // ================================================
  const progress = await prisma.user_progress.findMany({
    where: {
      userId,
      moduleId: {
        in: moduleIds
      }
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

  // ================================================
  // 5. Bangun status setiap module
  // ================================================
  moduleIds.forEach((moduleId) => {
    const modulEvaluations = evaluations.filter(
      (evaluation) => evaluation.moduleId === moduleId
    )

    const preTest =
      modulEvaluations.find(
        (evaluation) => evaluation.tipe === 'pre_test'
      ) || null

    const postTest =
      modulEvaluations.find(
        (evaluation) => evaluation.tipe === 'post_test'
      ) || null

    // ================================================
    // PRE-TEST
    // ================================================
    const preTestCompleted =
      !preTest || evaluationDijawab.has(preTest.id)

    // ================================================
    // MATERIAL
    // ================================================
    const modulContents = contents.filter(
      (content) => content.moduleId === moduleId
    )

    let completedContents = 0

    const materialDetail = modulContents.map((content) => {
      const adaMiniQuiz = content.miniQuizzes.length > 0

      // --------------------------------------------
      // Material/content completion
      // --------------------------------------------
      const contentProg = content.contentProgress[0] || null

      let progressSelesai = false

      if (contentProg) {
        if (content.tipe === 'video') {
          // Video selesai bila:
          // - isCompleted sudah true
          // ATAU
          // - progressPercent sudah mencapai 100.
          progressSelesai =
            contentProg.isCompleted === true ||
            (contentProg.progressPercent ?? 0) >= 100
        } else {
          // Teks / PDF / Link:
          // harus explicitly ditandai completed.
          progressSelesai =
            contentProg.isCompleted === true
        }
      }

      // --------------------------------------------
      // Mini-quiz completion
      // --------------------------------------------
      let miniQuizLulus = true

      if (adaMiniQuiz) {
        // SEMUA mini-quiz harus memiliki minimal
        // satu attempt yang lulus.
        miniQuizLulus = content.miniQuizzes.every(
          (miniQuiz) => miniQuiz.attempts.length > 0
        )
      }

      // --------------------------------------------
      // FINAL CONTENT COMPLETION
      //
      // TANPA mini-quiz:
      //   content selesai => selesai
      //
      // DENGAN mini-quiz:
      //   content selesai
      //   AND
      //   semua mini-quiz lulus
      //
      // Mini-quiz SAJA tidak cukup.
      // --------------------------------------------
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
        progressPercent: contentProg?.progressPercent ?? 0
      }
    })

    // ================================================
    // MATERIAL STAGE
    // ================================================
    const totalContents = modulContents.length

    const materialCompleted =
      totalContents === 0
        ? true
        : completedContents === totalContents

    // ================================================
    // POST-TEST
    // ================================================
    const passingScore = postTest?.passingScore ?? 80

    const postTestCompleted = !postTest
      ? true
      : (skorMap[moduleId] ?? 0) >= passingScore

    // ================================================
    // Simpan hasil stage
    // ================================================
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
  const progress = await prisma.user_progress.findMany({
    where: {
      userId
    },
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
            select: {
              contents: true,
              evaluations: true
            }
          }
        }
      }
    },

    orderBy: {
      module: {
        urutan: 'asc'
      }
    }
  })

  // Hitung status per tahap:
  // Pre-Test -> Material -> Post-Test
  const moduleIds = progress
    .map((item) => item.module?.id)
    .filter(Boolean)

  const stageMap = await hitungStageCompletion(
    userId,
    moduleIds
  )

  return progress.map((item) => {
    const stage = stageMap[item.module?.id] || {
      preTestCompleted: false,
      materialCompleted: false,
      postTestCompleted: false,
      materialProgress: {
        total: 0,
        completed: 0
      },
      materialDetail: []
    }

    return {
      ...item,

      preTestCompleted: stage.preTestCompleted,
      materialCompleted: stage.materialCompleted,
      postTestCompleted: stage.postTestCompleted,

      materialProgress:
        stage.materialProgress || {
          total: 0,
          completed: 0
        },

      materialDetail:
        stage.materialDetail || []
    }
  })
}

// ================================================
// GET SUMMARY — Ringkasan progress semua modul
// ================================================
const getSummary = async (userId) => {
  // ================================================
  // 1. Ambil semua module
  // ================================================
  const allModules = await prisma.module.findMany({
    select: {
      id: true,
      judul: true,
      aspekPancawaluya: true,
      urutan: true
    },

    orderBy: {
      urutan: 'asc'
    }
  })

  // ================================================
  // 2. Ambil progress guru
  // ================================================
  const userProgress = await prisma.user_progress.findMany({
    where: {
      userId
    },
    select: {
      moduleId: true,
      status: true,
      completedAt: true
    }
  })

  // ================================================
  // 3. Gabungkan module dengan progress
  // ================================================
  const summary = allModules.map((module) => {
    const progress = userProgress.find(
      (item) => item.moduleId === module.id
    )

    return {
      ...module,
      status: progress?.status || 'belum_mulai',
      completedAt: progress?.completedAt || null
    }
  })

  // ================================================
  // 4. Statistik keseluruhan
  // ================================================
  const totalModul = allModules.length

  const selesai = userProgress.filter(
    (item) => item.status === 'selesai'
  ).length

  const sedangBelajar = userProgress.filter(
    (item) => item.status === 'sedang_belajar'
  ).length

  const belumMulai =
    totalModul - selesai - sedangBelajar

  return {
    statistik: {
      totalModul,
      selesai,
      sedangBelajar,
      belumMulai,

      persentaseSelesai:
        totalModul > 0
          ? Math.round((selesai / totalModul) * 100)
          : 0
    },

    modul: summary
  }
}

// ================================================
// START MODULE — Mulai belajar modul
// ================================================
const startModule = async (userId, moduleId) => {
  // ================================================
  // Cek module
  // ================================================
  const moduleAda = await prisma.module.findUnique({
    where: {
      id: moduleId
    }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // ================================================
  // Cek progress existing
  // ================================================
  const existingProgress =
    await prisma.user_progress.findUnique({
      where: {
        userId_moduleId: {
          userId,
          moduleId
        }
      }
    })

  // Jangan mengubah module yang sudah selesai
  // menjadi sedang_belajar.
  if (
    existingProgress &&
    existingProgress.status === 'selesai'
  ) {
    return existingProgress
  }

  // ================================================
  // Upsert progress
  // ================================================
  const progress = await prisma.user_progress.upsert({
    where: {
      userId_moduleId: {
        userId,
        moduleId
      }
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
// COMPLETE MODULE — Tandai module selesai
//
// NOTE:
// Function ini masih mempertahankan behavior existing.
// Stage gate Pre-Test -> Material -> Post-Test
// sebaiknya ditangani sebagai follow-up terpisah
// bila endpoint ini memang harus menjadi enforcement gate.
// ================================================
const completeModule = async (userId, moduleId) => {
  // ================================================
  // Cek module
  // ================================================
  const moduleAda = await prisma.module.findUnique({
    where: {
      id: moduleId
    }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // ================================================
  // Set/update status
  // ================================================
  const now = new Date()

  const progress = await prisma.user_progress.upsert({
    where: {
      userId_moduleId: {
        userId,
        moduleId
      }
    },

    update: {
      status: 'selesai',
      completedAt: now
    },

    create: {
      userId,
      moduleId,
      status: 'selesai',
      completedAt: now
    }
  })

  return progress
}

// ================================================
// GET PROGRESS BY MODULE — Cek progress satu module
// ================================================
const getProgressByModule = async (
  userId,
  moduleId
) => {
  const progress =
    await prisma.user_progress.findUnique({
      where: {
        userId_moduleId: {
          userId,
          moduleId
        }
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

  // Hitung stage untuk module ini
  const stageMap = await hitungStageCompletion(
    userId,
    [moduleId]
  )

  const stage = stageMap[moduleId] || {
    preTestCompleted: false,
    materialCompleted: false,
    postTestCompleted: false,
    materialProgress: {
      total: 0,
      completed: 0
    },
    materialDetail: []
  }

  // ================================================
  // Jika belum memiliki user_progress
  // ================================================
  if (!progress) {
    return {
      status: 'belum_mulai',
      completedAt: null,

      preTestCompleted:
        stage.preTestCompleted,

      materialCompleted:
        stage.materialCompleted,

      postTestCompleted:
        stage.postTestCompleted,

      materialProgress:
        stage.materialProgress || {
          total: 0,
          completed: 0
        },

      materialDetail:
        stage.materialDetail || []
    }
  }

  // ================================================
  // Return progress + stage
  // ================================================
  return {
    ...progress,

    preTestCompleted:
      stage.preTestCompleted,

    materialCompleted:
      stage.materialCompleted,

    postTestCompleted:
      stage.postTestCompleted,

    materialProgress:
      stage.materialProgress || {
        total: 0,
        completed: 0
      },

    materialDetail:
      stage.materialDetail || []
  }
}

// ================================================
// MARK CONTENT COMPLETE
//
// Guru menandai satu material selesai.
//
// Completion:
// - video:
//   wajib progressPercent >= 100.
// - teks/pdf/link:
//   explicit completion.
//
// CATATAN:
// Jika content memiliki mini-quiz,
// endpoint ini hanya menandai CONTENT selesai.
// Material stage tetap membutuhkan:
//   content selesai
//   DAN
//   seluruh mini-quiz lulus.
// ================================================
const markContentComplete = async (
  userId,
  contentId
) => {
  const content =
    await prisma.content.findUnique({
      where: {
        id: contentId
      },

      select: {
        id: true,
        tipe: true,
        moduleId: true
      }
    })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  // ================================================
  // Video wajib mencapai 100%
  // ================================================
  if (content.tipe === 'video') {
    const existing =
      await prisma.user_content_progress.findUnique({
        where: {
          userId_contentId: {
            userId,
            contentId
          }
        }
      })

    const percent =
      existing?.progressPercent ?? 0

    if (percent < 100) {
      throw new Error(
        'Video belum selesai ditonton 100%'
      )
    }
  }

  // ================================================
  // Simpan completion
  // ================================================
  const now = new Date()

  const saved =
    await prisma.user_content_progress.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      },

      update: {
        isCompleted: true,
        progressPercent: 100,
        completedAt: now
      },

      create: {
        userId,
        contentId,
        isCompleted: true,
        progressPercent: 100,
        completedAt: now
      }
    })

  return {
    contentId,
    tipe: content.tipe,
    ...saved
  }
}

// ================================================
// UPDATE CONTENT PROGRESS
//
// Digunakan terutama untuk video.
//
// Rules:
// - progress harus integer 0-100.
// - progress tidak boleh mundur.
// - setelah completed, progress tidak boleh kembali
//   menjadi incomplete.
// - mencapai 100% otomatis menandai content selesai.
//
// Contoh:
//
// 20 -> 40 -> 70 -> 100
//
// Tetapi:
//
// 100 -> 50
// TIDAK akan menurunkan progress.
// ================================================
const updateContentProgress = async (
  userId,
  contentId,
  progressPercent
) => {
  const content =
    await prisma.content.findUnique({
      where: {
        id: contentId
      },

      select: {
        id: true,
        tipe: true,
        moduleId: true
      }
    })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  // ================================================
  // Validasi progress
  // ================================================
  const nilai = Number(progressPercent)

  if (
    !Number.isFinite(nilai) ||
    !Number.isInteger(nilai) ||
    nilai < 0 ||
    nilai > 100
  ) {
    throw new Error(
      'Progress harus berupa angka bulat 0-100'
    )
  }

  // ================================================
  // Ambil existing progress
  // ================================================
  const existing =
    await prisma.user_content_progress.findUnique({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      }
    })

  // ================================================
  // Progress bersifat monotonic.
  //
  // Kalau sebelumnya 70 dan FE mengirim 50,
  // tetap gunakan 70.
  // ================================================
  const currentPercent =
    existing?.progressPercent ?? 0

  const nilaiFinal =
    Math.max(currentPercent, nilai)

  // ================================================
  // Kalau sudah pernah complete,
  // jangan pernah membuatnya incomplete.
  // ================================================
  const alreadyCompleted =
    existing?.isCompleted === true

  const isCompleted =
    alreadyCompleted ||
    nilaiFinal >= 100

  // ================================================
  // completedAt hanya diisi saat pertama kali
  // completion tercapai.
  // ================================================
  let completedAt =
    existing?.completedAt ?? null

  if (isCompleted && !completedAt) {
    completedAt = new Date()
  }

  // ================================================
  // Simpan
  // ================================================
  const saved =
    await prisma.user_content_progress.upsert({
      where: {
        userId_contentId: {
          userId,
          contentId
        }
      },

      update: {
        progressPercent: nilaiFinal,
        isCompleted,
        completedAt
      },

      create: {
        userId,
        contentId,
        progressPercent: nilaiFinal,
        isCompleted,
        completedAt
      }
    })

  return {
    contentId,
    tipe: content.tipe,
    ...saved
  }
}

// ================================================
// EXPORT
// ================================================
module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule,
  getProgressByModule,
  markContentComplete,
  updateContentProgress
}