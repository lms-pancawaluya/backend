const prisma = require('../../config/database') 
/**
 * Ambil daftar notifikasi milik user yang sedang login
 */
const getMyNotifications = async (userId) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30 // Ambil 30 notifikasi terbaru
  })
}

/**
 * Hitung jumlah notifikasi yang belum dibaca (untuk badge merah/counter di FE)
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

  // Cek apakah notifikasi ini milik user yang sedang request
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
 * HELPER INTERNAL: Membuat Notifikasi Baru
 * Dipakai oleh modul lain (Helpdesk, Content, RTL, dll)
 *
 * Contoh pemanggilan dari modul helpdesk:
 * await notificationService.createNotification({
 *   userId: ticket.userId,
 *   title: 'Balasan Tiket Bantuan',
 *   message: 'Admin membalas tiket kamu',
 *   type: 'HELPDESK_REPLY',
 *   linkUrl: `/helpdesk/tickets/${ticketId}`
 * })
 */
const createNotification = async ({ userId, title, message, type, linkUrl = null }) => {
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
 * Cocok untuk pengumuman modul baru ke banyak user sekaligus
 */
const createManyNotifications = async (notificationsArray) => {
  return await prisma.notification.createMany({
    data: notificationsArray
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