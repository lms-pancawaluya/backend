// src/modules/comments/comments.service.js

const prisma = require('../../config/database')
const notificationService = require('../notifications/notifications.service') // Import notificationService

// 1. Tambah Komentar Baru (Bisa Root Comment / Reply Comment)
const createComment = async (userId, data) => {
  const { moduleId, komentar, parentId } = data // Tangkap parentId jika ada balasan

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
      komentar,
      ...(parentId && { parentId }) // Simpan parentId jika membalas komentar
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

  // ================================================
  // AUTO NOTIFIKASI
  // ================================================
  try {
    // SCENARIO 1: MEMBALAS KOMENTAR (Reply Comment)
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true }
      })

      // Kirim notifikasi HANYA jika yang membalas BUKAN pembuat komentar itu sendiri
      if (parentComment && parentComment.userId !== userId) {
        await notificationService.createNotification({
          userId: parentComment.userId, // Pemilik komentar utama (Guru/Pengajar/Admin)
          title: 'Balasan Komentar',
          message: `${newComment.user.nama} membalas komentar kamu di Modul "${moduleExist.judul}".`,
          type: 'COMMENT_REPLY',
          linkUrl: `/modules/${moduleId}?commentId=${newComment.id}`
        })
      }
    } 
    // SCENARIO 2: KOMENTAR UTAMA BARU (Root Comment)
    else {
      const pengajarList = await prisma.user.findMany({
        where: {
          role: 'pengajar',
          NOT: { id: userId } // Jangan kirim ke diri sendiri jika pengajar yang menulis komentar
        },
        select: { id: true }
      })

      if (pengajarList.length > 0) {
        const notificationsData = pengajarList.map((pengajar) => ({
          userId: pengajar.id,
          title: 'Komentar Baru di Modul',
          message: `${newComment.user.nama} menambahkan komentar baru di Modul ${moduleExist.judul}.`,
          type: 'NEW_COMMENT',
          linkUrl: `/modules/${moduleId}?commentId=${newComment.id}`
        }))

        await notificationService.createManyNotifications(notificationsData)
      }
    }
  } catch (error) {
    console.error('Gagal mengirimkan notifikasi komentar:', error.message)
  }

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