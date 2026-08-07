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
// GET SUMMARY — Ringkasan progress semua modul
// ================================================
const getSummary = async (userId) => {
  // Ambil semua modul yang ada
  const allModules = await prisma.module.findMany({
    select: {
      id: true,
      judul: true,
      aspekPancawaluya: true,
      urutan: true
    },
    orderBy: { urutan: 'asc' }
  })

  // Ambil progress guru untuk semua modul
  const userProgress = await prisma.user_progress.findMany({
    where: { userId },
    select: {
      moduleId: true,
      status: true,
      completedAt: true
    }
  })

  // Gabungkan data modul dengan progress guru
  const summary = allModules.map(module => {
    const progress = userProgress.find(p => p.moduleId === module.id)

    return {
      ...module,
      status: progress?.status || 'belum_mulai',
      completedAt: progress?.completedAt || null
    }
  })

  // Hitung statistik
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
// START MODULE — Mulai belajar modul
// ================================================
const startModule = async (userId, moduleId) => {
  // Cek apakah modul ada
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // Pakai upsert — kalau sudah ada progress, tidak buat baru
  const progress = await prisma.user_progress.upsert({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    update: {
      // Kalau sudah selesai, jangan reset ke sedang_belajar
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
// COMPLETE MODULE — Tandai modul selesai
// ================================================
const completeModule = async (userId, moduleId) => {
  // Cek apakah progress ada
  const progressAda = await prisma.user_progress.findUnique({
    where: {
      userId_moduleId: { userId, moduleId }
    }
  })

  if (!progressAda) {
    throw new Error('Kamu belum memulai modul ini. Mulai dulu sebelum menyelesaikan.')
  }

  if (progressAda.status === 'selesai') {
    throw new Error('Modul ini sudah selesai sebelumnya')
  }

  const progress = await prisma.user_progress.update({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    data: {
      status: 'selesai',
      completedAt: new Date()
    }
  })

  return progress
}

module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule
}