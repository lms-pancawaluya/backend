const prisma = require('../../config/database')

const COOLDOWN_DAYS = 7
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000 // 7 hari dalam milidetik

// Guru kirim saran & masukan per course (dengan limit 1x per 7 hari)
const createFeedback = async (userId, courseId, data) => {
  const { saran, masukan, moduleId } = data

  if (!saran || saran.trim() === '') {
    throw new Error('Saran wajib diisi')
  }

  const courseAda = await prisma.course.findUnique({
    where: { id: courseId }
  })

  if (!courseAda) {
    const error = new Error('Course tidak ditemukan')
    error.statusCode = 404
    throw error
  }

  // Cek feedback terakhir user pada course ini
  const lastFeedback = await prisma.feedback.findFirst({
    where: {
      userId,
      courseId
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (lastFeedback) {
    const now = new Date()
    const lastSubmittedAt = new Date(lastFeedback.createdAt)
    const nextAllowedAt = new Date(lastSubmittedAt.getTime() + COOLDOWN_MS)

    if (now < nextAllowedAt) {
      const error = new Error(`Anda hanya dapat mengirim saran dan masukan 1 kali dalam ${COOLDOWN_DAYS} hari.`)
      error.statusCode = 429
      error.data = {
        nextAllowedAt: nextAllowedAt.toISOString()
      }
      throw error
    }
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId,
      courseId,
      moduleId: moduleId || null, // Opsional untuk legacy data
      saran,
      masukan: masukan || null
    },
    include: {
      course: {
        select: { id: true, judul: true }
      }
    }
  })

  return feedback
}

// Admin melihat semua daftar masukan/feedback
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