const helpdeskService = require('./helpdesk.service')

const createTicket = async (req, res) => {
  try {
    const userId = req.user.id
    const hasil = await helpdeskService.createTicket(userId, req.body)

    return res.status(201).json({
      sukses: true,
      pesan: 'Tiket bantuan berhasil dibuat',
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id
    const hasil = await helpdeskService.getMyTickets(userId)

    return res.status(200).json({
      sukses: true,
      jumlah: hasil.length,
      data: hasil
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getAllTickets = async (req, res) => {
  try {
    const { status, category } = req.query
    const hasil = await helpdeskService.getAllTickets({ status, category })

    return res.status(200).json({
      sukses: true,
      jumlah: hasil.length,
      data: hasil
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getTicketById = async (req, res) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const { ticketId } = req.params

    const hasil = await helpdeskService.getTicketById(ticketId, userId, userRole)

    return res.status(200).json({
      sukses: true,
      data: hasil
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const replyTicket = async (req, res) => {
  try {
    const senderId = req.user.id
    const userRole = req.user.role
    const { ticketId } = req.params

    const hasil = await helpdeskService.replyTicket(ticketId, senderId, userRole, req.body)

    return res.status(201).json({
      sukses: true,
      pesan: 'Balasan berhasil dikirim',
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params
    const { status } = req.body

    const hasil = await helpdeskService.updateTicketStatus(ticketId, status)

    return res.status(200).json({
      sukses: true,
      pesan: `Status tiket berhasil diubah menjadi ${hasil.status}`,
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  replyTicket,
  updateTicketStatus
}