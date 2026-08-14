const prisma = require('../../config/database')

// 1. Progress Modul Per Guru
const getUserModuleProgress = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nama: true, email: true }
  })

  if (!user) {
    throw new Error('User/Guru tidak ditemukan')
  }

  // Ambil semua modul terurut
  const allModules = await prisma.module.findMany({
    orderBy: { urutan: 'asc' },
    select: {
      id: true,
      judul: true,
      urutan: true
    }
  })

  // Ambil progress user untuk semua modul
  const userProgresses = await prisma.user_progress.findMany({
    where: { userId }
  })

  let modulSelesaiCount = 0

  const moduls = allModules.map(module => {
    const progress = userProgresses.find(p => p.moduleId === module.id)
    const isSelesai = progress?.status === 'selesai'

    if (isSelesai) modulSelesaiCount++

    return {
      moduleId: module.id,
      judul: module.judul,
      urutan: module.urutan,
      status: progress ? progress.status : 'belum_mulai',
      skor: progress?.skor || 0,
      completedAt: progress?.completedAt || null
    }
  })

  const totalModul = allModules.length
  const persentase = totalModul > 0 ? Math.round((modulSelesaiCount / totalModul) * 100) : 0

  return {
    userId: user.id,
    namaGuru: user.nama,
    emailGuru: user.email,
    totalModul,
    modulSelesai: modulSelesaiCount,
    persentase,
    moduls
  }
}

// 2. Hasil Evaluasi Per Guru
const getUserEvaluations = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nama: true, email: true }
  })

  if (!user) {
    throw new Error('User/Guru tidak ditemukan')
  }

  // Ambil semua evaluasi beserta data modulnya
  const allEvaluations = await prisma.evaluation.findMany({
    select: {
      id: true,
      judul: true,
      moduleId: true,
      module: {
        select: {
          id: true,
          judul: true,
          urutan: true
        }
      }
    },
    orderBy: { module: { urutan: 'asc' } }
  })

  // Ambil progress modul user untuk tau skor & status lulus
  const userProgresses = await prisma.user_progress.findMany({
    where: { userId }
  })

  const result = allEvaluations.map(evalItem => {
    const progress = userProgresses.find(p => p.moduleId === evalItem.moduleId)
    const dikerjakan = !!progress && (progress.status === 'selesai' || progress.skor !== null)

    return {
      userId: user.id,
      moduleId: evalItem.moduleId,
      moduleJudul: evalItem.module.judul,
      evaluationId: evalItem.id,
      evaluationJudul: evalItem.judul,
      dikerjakan,
      skor: dikerjakan ? progress.skor : null,
      status: progress ? progress.status : 'belum_mulai'
    }
  })

  return {
    userId: user.id,
    namaGuru: user.nama,
    evaluations: result
  }
}

module.exports = {
  getUserModuleProgress,
  getUserEvaluations
}