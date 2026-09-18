const prisma = require('../../config/database')

// Guru kirim saran & masukan pikeun course tangtu
const createFeedback = async (userId, courseId, data) => {
  const { saran, masukan, moduleId } = data

  if (!saran) {
    throw new Error('Saran wajib diisi')
  }

  const courseAda = await prisma.course.findUnique({
    where: { id: courseId }
  })

  if (!courseAda) {
    throw new Error('Course tidak ditemukan')
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      courseId,
      moduleId: moduleId || null, // Opsional pikeun legacy data
      saran,
      masukan: masukan || null
    }
  })

  return feedback
}

// Admin ningali sadaya daptar masukan/feedback
const getAllFeedbacks = async () => {
  return prisma.feedback.findMany({
    include: {
      user: { select: { id: true, nama: true, email: true, sekolah: true } },
      course: { select: { id: true, judul: true } },
      module: { select: { id: true, judul: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

module.exports = {
  createFeedback,
  getAllFeedbacks
}