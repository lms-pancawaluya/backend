const express = require('express')
const router = express.Router()
const feedbackController = require('./feedback.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// POST: Guru kirim saran & kritik per modul
router.post('/module/:moduleId',
  authMiddleware,
  feedbackController.createFeedback
)

// GET: Admin melihat semua saran & kritik dari guru
router.get('/',
  authMiddleware,
  roleMiddleware('admin'),
  feedbackController.getAllFeedbacks
)

module.exports = router