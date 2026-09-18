// src/modules/comments/comments.service.js

const prisma = require('../../config/database')
const notificationService = require('../notifications/notifications.service')

// Select standar untuk info user agar struktur respons konsisten
const userSelect = {
  id: true,
  nama: true,
  fotoProfil: true,
  role: true,
  gelar: true
}

// 1. Tambah Komentar Baru (Bisa Root / Reply / Mention)
const createComment = async (userId, data) => {
  const { courseId, moduleId, komentar, parentId, mentionedUserIds = [] } = data

  // Validasi: Harus ada setidaknya courseId atau moduleId
  if (!courseId && !moduleId) {
    throw new Error('Course ID atau Module ID wajib diisi')
  }

  if (!komentar || komentar.trim() === '') {
    throw new Error('Isi komentar wajib diisi')
  }

  // Filter unique user IDs & cegah mention ke diri sendiri
  const uniqueMentionedUserIds = Array.isArray(mentionedUserIds)
    ? [...new Set(mentionedUserIds)].filter((id) => id !== userId)
    : []

  // Cek keberadaan Context (Course / Module)
  let contextTitle = ''
  let targetCourseId = courseId

  if (courseId) {
    const courseExist = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, judul: true }
    })
    if (!courseExist) throw new Error('Course tidak ditemukan')
    contextTitle = courseExist.judul
  } else if (moduleId) {
    const moduleExist = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { id: true, judul: true, courseId: true }
    })
    if (!moduleExist) throw new Error('Modul tidak ditemukan')
    contextTitle = moduleExist.judul
    targetCourseId = moduleExist.courseId
  }

  // Buat Komentar beserta Mentions (jika ada) dalam satu transaksi Prisma
  const newComment = await prisma.comment.create({
    data: {
      userId,
      komentar,
      courseId: targetCourseId || null,
      moduleId: moduleId || null,
      ...(parentId && { parentId }),
      ...(uniqueMentionedUserIds.length > 0 && {
        mentions: {
          create: uniqueMentionedUserIds.map((mUserId) => ({
            userId: mUserId
          }))
        }
      })
    },
    include: {
      user: {
        select: userSelect
      },
      mentions: {
        include: {
          user: {
            select: userSelect
          }
        }
      }
    }
  })

  // ================================================
  // AUTO NOTIFIKASI
  // ================================================
  try {
    const linkUrl = targetCourseId 
      ? `/courses/${targetCourseId}?commentId=${newComment.id}`
      : `/modules/${moduleId}?commentId=${newComment.id}`

    // A. SCENARIO MENTION USER
    if (uniqueMentionedUserIds.length > 0) {
      const mentionNotifications = uniqueMentionedUserIds.map((mUserId) => ({
        userId: mUserId,
        title: 'Kamu Di-mention dalam Komentar',
        message: `${newComment.user.nama} menyebut kamu dalam komentar di "${contextTitle}".`,
        type: 'COMMENT_MENTION',
        linkUrl
      }))

      await notificationService.createManyNotifications(mentionNotifications)
    }

    // B. SCENARIO REPLY COMMENT
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true }
      })

      if (parentComment && parentComment.userId !== userId) {
        await notificationService.createNotification({
          userId: parentComment.userId,
          title: 'Balasan Komentar',
          message: `${newComment.user.nama} membalas komentar kamu di "${contextTitle}".`,
          type: 'COMMENT_REPLY',
          linkUrl
        })
      }
    } 
    // C. SCENARIO ROOT COMMENT (Notifikasi ke Pengajar)
    else {
      const pengajarList = await prisma.user.findMany({
        where: {
          role: 'pengajar',
          NOT: { id: userId }
        },
        select: { id: true }
      })

      if (pengajarList.length > 0) {
        const notificationsData = pengajarList.map((pengajar) => ({
          userId: pengajar.id,
          title: 'Komentar Baru',
          message: `${newComment.user.nama} menambahkan komentar baru di "${contextTitle}".`,
          type: 'NEW_COMMENT',
          linkUrl
        }))

        await notificationService.createManyNotifications(notificationsData)
      }
    }
  } catch (error) {
    console.error('Gagal mengirimkan notifikasi komentar:', error.message)
  }

  return newComment
}

// 2. Get Komentar Berdasarkan Course ID / Module ID (Termasuk Reply & Mentions)
const getCommentsByCourse = async (courseId, moduleId) => {
  if (!courseId && !moduleId) {
    throw new Error('Course ID atau Module ID wajib disertakan')
  }

  // Filter HANYA komentar utama (parentId: null) agar reply tidak terduplikasi di root
  const whereCondition = {
    parentId: null,
    ...(courseId ? { courseId } : { moduleId })
  }

  const comments = await prisma.comment.findMany({
    where: whereCondition,
    include: {
      user: {
        select: userSelect
      },
      mentions: {
        include: {
          user: {
            select: userSelect
          }
        }
      },
      replies: {
        include: {
          user: {
            select: userSelect
          },
          mentions: {
            include: {
              user: {
                select: userSelect
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return comments
}

// 3. Hapus Komentar
const deleteComment = async (commentId, userId, userRole) => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId }
  })

  if (!comment) {
    throw new Error('Komentar tidak ditemukan')
  }

  if (comment.userId !== userId && userRole !== 'admin') {
    throw new Error('Kamu tidak memiliki akses untuk menghapus komentar ini')
  }

  await prisma.comment.delete({
    where: { id: commentId }
  })

  return { pesan: 'Komentar berhasil dihapus' }
}

// 4. Cari User untuk Autocomplete Mention (@)
const searchMentionableUsers = async (query) => {
  return await prisma.user.findMany({
    where: {
      status: 'aktif',
      ...(query && {
        nama: {
          contains: query,
          mode: 'insensitive'
        }
      })
    },
    select: userSelect,
    take: 10
  })
}

module.exports = {
  createComment,
  getCommentsByCourse,
  deleteComment,
  searchMentionableUsers
}