const prisma = require('../../config/database')

// Guru kirim saran & kritik untuk modul tertentu
const createFeedback = async (userId, moduleId, data) => {
  const { saran, kritik } = data

  if (!saran) {
    throw new Error('Saran wajib diisi')
  }

  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      moduleId,
      saran,
      kritik
    }
  })

  return feedback
}

// Admin melihat seluruh daftar masukan
const getAllFeedbacks = async () => {
  return prisma.feedback.findMany({
    include: {
      user: { select: { id: true, nama: true, email: true, sekolah: true } },
      module: { select: { id: true, judul: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

module.exports = {
  createFeedback,
  getAllFeedbacks
}