// src/modules/helpdesk/helpdesk.service.js

const prisma = require('../../config/database')
const notificationService = require('../notifications/notifications.service')
const { TICKET_CATEGORIES } = require('./helpdesk.constants')

// GET: Daftar Kategori Resmi untuk Helpdesk Ticket
const getCategories = () => {
  return TICKET_CATEGORIES
}

// Generate nomor tiket otomatis yang lebih unik (contoh: TKT-20260826-A8K2)
const generateTicketNumber = () => {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TKT-${dateStr}-${randomStr}`
}

// GURU: Buat Tiket Baru
const createTicket = async (userId, data) => {
  const { subject, category, description } = data

  if (!subject || !category || !description) {
    throw new Error('Subject, category, dan description wajib diisi')
  }

  // VALIDASI KATEGORI: Harus salah satu dari TICKET_CATEGORIES
  const validCategoryValues = TICKET_CATEGORIES.map((c) => c.value)
  if (!validCategoryValues.includes(category)) {
    throw new Error(`Kategori '${category}' tidak valid. Kategori yang diperbolehkan: ${validCategoryValues.join(', ')}`)
  }

  const ticketNumber = generateTicketNumber()

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      userId,
      subject,
      category,
      description,
      status: 'open'
    },
    include: {
      user: {
        select: { nama: true }
      }
    }
  })

  // ================================================
  // AUTO NOTIFIKASI: Kirim ke Admin & Pengajar
  // ================================================
  try {
    const adminAndMentors = await prisma.user.findMany({
      where: {
        role: { in: ['admin', 'pengajar'] }
      },
      select: { id: true, role: true }
    })

    if (adminAndMentors.length > 0) {
      const notificationsData = adminAndMentors.map((staff) => {
        const isPengajar = staff.role === 'pengajar'
        return {
          userId: staff.id,
          title: isPengajar ? 'Tiket Helpdesk Baru (Prioritas)' : 'Tiket Helpdesk Masuk',
          message: isPengajar
            ? `Tiket baru #${ticket.ticketNumber} dari ${ticket.user.nama} membutuhkan bantuan.`
            : `Tiket bantuan baru #${ticket.ticketNumber} dibuat oleh ${ticket.user.nama}.`,
          type: 'NEW_HELPDESK_TICKET',
          linkUrl: `/helpdesk/tickets/${ticket.id}`
        }
      })

      await notificationService.createManyNotifications(notificationsData)
    }
  } catch (error) {
    console.error('Gagal mengirim notifikasi tiket baru:', error.message)
  }

  return ticket
}

// GURU: Get Daftar Tiket Milik Sendiri
const getMyTickets = async (userId) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  })
  return tickets
}

// ADMIN / PENGAJAR: Get Semua Tiket
const getAllTickets = async (filters) => {
  const { status, category } = filters
  const whereClause = {}

  if (status) whereClause.status = status
  if (category) whereClause.category = category

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    include: {
      user: {
        select: { 
          id: true, 
          nama: true, 
          email: true, 
          sekolah: true,
          role: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return tickets
}

// GURU & ADMIN: Get Detail Tiket + Percakapan Balasan
const getTicketById = async (ticketId, userId, userRole) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: { 
          id: true, 
          nama: true, 
          email: true, 
          sekolah: true,
          role: true
        }
      },
      replies: {
        include: {
          sender: {
            select: { id: true, nama: true, role: true, fotoProfil: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!ticket) {
    throw new Error('Tiket tidak ditemukan')
  }

  // Jika role guru, hanya boleh lihat tiket miliknya sendiri
  if (userRole === 'guru' && ticket.userId !== userId) {
    throw new Error('Akses ditolak: Anda tidak memiliki akses ke tiket ini')
  }

  return ticket
}

// GURU & ADMIN: Balas Tiket
const replyTicket = async (ticketId, senderId, userRole, data) => {
  const { message } = data

  if (!message) {
    throw new Error('Pesan balasan wajib diisi')
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId }
  })

  if (!ticket) {
    throw new Error('Tiket tidak ditemukan')
  }

  // VALIDASI: Tiket yang sudah closed tidak bisa dibalas
  if (ticket.status === 'closed') {
    throw new Error('Tiket sudah ditutup dan tidak dapat dibalas lagi')
  }

  if (userRole === 'guru' && ticket.userId !== senderId) {
    throw new Error('Akses ditolak')
  }

  // Buat balasan
  const reply = await prisma.ticketReply.create({
    data: {
      ticketId,
      senderId,
      message
    },
    include: {
      sender: {
        select: { id: true, nama: true, role: true }
      }
    }
  })

  // Jika yang membalas adalah Admin/Pengajar & status masih open, ubah otomatis ke in_progress
  if (['admin', 'pengajar'].includes(userRole) && ticket.status === 'open') {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'in_progress' }
    })
  } else {
    // Update updatedAt tiket agar naik ke atas
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    })
  }

  // ================================================
  // AUTO NOTIFIKASI: Kirim Balasan Tiket
  // ================================================
  try {
    if (['admin', 'pengajar'].includes(userRole)) {
      // Jika Admin/Pengajar membalas, kirim notifikasi ke GURU pemilik tiket
      await notificationService.createNotification({
        userId: ticket.userId,
        title: 'Balasan Helpdesk',
        message: `Tiket #${ticket.ticketNumber} kamu telah dibalas oleh ${reply.sender.nama}.`,
        type: 'HELPDESK_REPLY',
        linkUrl: `/helpdesk/tickets/${ticket.id}`
      })
    } else {
      // Jika Guru membalas, kirim notifikasi ke seluruh Admin & Pengajar
      const staffList = await prisma.user.findMany({
        where: { role: { in: ['admin', 'pengajar'] } },
        select: { id: true }
      })

      if (staffList.length > 0) {
        const notifData = staffList.map((staff) => ({
          userId: staff.id,
          title: 'Balasan Tiket Bantuan',
          message: `${reply.sender.nama} membalas tiket #${ticket.ticketNumber}`,
          type: 'HELPDESK_REPLY',
          linkUrl: `/helpdesk/tickets/${ticket.id}`
        }))

        await notificationService.createManyNotifications(notifData)
      }
    }
  } catch (error) {
    console.error('Gagal mengirim notifikasi balasan tiket:', error.message)
  }

  return reply
}

// ADMIN: Update Status Tiket
const updateTicketStatus = async (ticketId, status) => {
  const validStatus = ['open', 'in_progress', 'resolved', 'closed']

  if (!validStatus.includes(status)) {
    throw new Error(`Status harus salah satu dari: ${validStatus.join(', ')}`)
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId }
  })

  if (!ticket) {
    throw new Error('Tiket tidak ditemukan')
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status }
  })

  return updatedTicket
}

module.exports = {
  getCategories,
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  replyTicket,
  updateTicketStatus
}