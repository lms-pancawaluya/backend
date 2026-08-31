// src/modules/helpdesk/helpdesk.service.js

const prisma = require('../../config/database')

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

  const ticketNumber = generateTicketNumber()

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      userId,
      subject,
      category,
      description,
      status: 'open'
    }
  })

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
          role: true // <-- TAMBAHAN UNTUK FE ADMIN (HIGHLIGHT TIKET PENGAJAR)
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
          role: true // <-- TAMBAHAN UNTUK FE ADMIN (HIGHLIGHT TIKET PENGAJAR)
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

  // VALIDASI BARU: Tiket yang sudah closed tidak bisa dibalas
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
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  replyTicket,
  updateTicketStatus
}