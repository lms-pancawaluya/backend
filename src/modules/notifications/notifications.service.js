// src/modules/notifications/notifications.service.js

const crypto = require('crypto') 
const prisma = require('../../config/database')

/**
 * Ambil daftar notifikasi milik user yang sedang login
 */
const getMyNotifications = async (userId) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30
  })
}

/**
 * Hitung jumlah notifikasi yang belum dibaca
 */
const getUnreadCount = async (userId) => {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  })
  return { unreadCount: count }
}

/**
 * Tandai 1 notifikasi spesifik sebagai sudah dibaca
 */
const markAsRead = async (notificationId, userId) => {
  const notif = await prisma.notification.findUnique({
    where: { id: notificationId }
  })

  if (!notif) {
    throw new Error('Notifikasi tidak ditemukan')
  }

  if (notif.userId !== userId) {
    throw new Error('Kamu tidak memiliki akses ke notifikasi ini')
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true }
  })
}

/**
 * Tandai SEMUA notifikasi milik user sebagai sudah dibaca
 */
const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: { isRead: true }
  })
  return { pesan: 'Semua notifikasi berhasil ditandai sebagai dibaca' }
}

/**
 * HELPER INTERNAL: Membuat Notifikasi Baru (Memperhatikan Preference User)
 */
const createNotification = async ({ userId, title, message, type, linkUrl = null }) => {
  // Cek apakah user mengaktifkan notifikasi
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsEnabled: true }
  })

  // Jika user mematikan notifikasi, abaikan pembuatan notifikasi
  if (user && user.notificationsEnabled === false) {
    return null
  }

  return await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      linkUrl
    }
  })
}

/**
 * HELPER INTERNAL: Kirim Notifikasi Masal (Broadcasting)
 * Filter hanya ke user yang mengaktifkan notificationsEnabled
 */
const createManyNotifications = async (notificationsArray) => {
  if (!notificationsArray || notificationsArray.length === 0) return

  // Ambil semua userId dari array
  const userIds = [...new Set(notificationsArray.map((n) => n.userId))]

  // Ambil daftar user yang mengaktifkan notifikasi
  const activeUsers = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      notificationsEnabled: true
    },
    select: { id: true }
  })

  const activeUserIds = new Set(activeUsers.map((u) => u.id))

  // Filter hanya notifikasi milik user yang aktif
  const filteredNotifications = notificationsArray
    .filter((notif) => activeUserIds.has(notif.userId))
    .map((notif) => ({
      id: crypto.randomUUID(),
      ...notif
    }))

  if (filteredNotifications.length === 0) return

  return await prisma.notification.createMany({
    data: filteredNotifications
  })
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  createManyNotifications
}