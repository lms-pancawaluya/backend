// src/modules/progress/progress.service.js

const prisma = require('../../config/database')

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

  return progress
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

  if (!progress) {
    return {
      status: 'belum_mulai',
      completedAt: null
    }
  }

  return progress
}

module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule,
  getProgressByModule
}