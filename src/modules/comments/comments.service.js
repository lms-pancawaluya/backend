const prisma = require('../../config/database')

// 1. Tambah Komentar Baru
const createComment = async (userId, data) => {
  const { moduleId, komentar } = data

  if (!moduleId || !komentar) {
    throw new Error('Module ID dan isi komentar wajib diisi')
  }

  // Cek apakah modul ada
  const moduleExist = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleExist) {
    throw new Error('Modul tidak ditemukan')
  }

  const newComment = await prisma.comment.create({
    data: {
      userId,
      moduleId,
      komentar
    },
    include: {
      user: {
        select: {
          id: true,
          nama: true,
          fotoProfil: true,
          role: true,
          gelar: true
        }
      }
    }
  })

  return newComment
}

// 2. Get Semua Komentar Berdasarkan Module ID
const getCommentsByModule = async (moduleId) => {
  if (!moduleId) {
    throw new Error('Module ID wajib disertakan')
  }

  const comments = await prisma.comment.findMany({
    where: { moduleId },
    include: {
      user: {
        select: {
          id: true,
          nama: true,
          fotoProfil: true,
          role: true,
          gelar: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc' // Komentar terbaru di paling atas
    }
  })

  return comments
}

// 3. Hapus Komentar (Oleh Pemilik Komentar atau Admin)
const deleteComment = async (commentId, userId, userRole) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId }
  })

  if (!comment) {
    throw new Error('Komentar tidak ditemukan')
  }

  // Hanya pemilik komentar ATAU Admin yang boleh menghapus
  if (comment.userId !== userId && userRole !== 'admin') {
    throw new Error('Kamu tidak memiliki akses untuk menghapus komentar ini')
  }

  await prisma.comment.delete({
    where: { id: commentId }
  })

  return { pesan: 'Komentar berhasil dihapus' }
}

module.exports = {
  createComment,
  getCommentsByModule,
  deleteComment
}