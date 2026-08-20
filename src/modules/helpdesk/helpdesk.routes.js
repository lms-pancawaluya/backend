const express = require('express')
const router = express.Router()
const helpdeskController = require('./helpdesk.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// Endpoint umum (Guru / Admin / Pengajar)
router.post('/tickets', authMiddleware, helpdeskController.createTicket)
router.get('/tickets/my', authMiddleware, helpdeskController.getMyTickets)

// Endpoint khusus Admin / Pengajar
router.get('/tickets', authMiddleware, roleMiddleware('admin', 'pengajar'), helpdeskController.getAllTickets)
router.patch('/tickets/:ticketId/status', authMiddleware, roleMiddleware('admin', 'pengajar'), helpdeskController.updateTicketStatus)

// Detail & Balas (Berlaku untuk Guru pemilik tiket / Admin / Pengajar)
router.get('/tickets/:ticketId', authMiddleware, helpdeskController.getTicketById)
router.post('/tickets/:ticketId/replies', authMiddleware, helpdeskController.replyTicket)

module.exports = router