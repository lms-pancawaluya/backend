const express = require('express')
const router = express.Router()
const feedbackController = require('./feedback.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// POST: Guru kirim saran & masukan per course
router.post('/course/:courseId',
  authMiddleware,
  feedbackController.createFeedback
)

// GET: Admin melihat semua saran & masukan dari guru
router.get('/',
  authMiddleware,
  roleMiddleware('admin'),
  feedbackController.getAllFeedbacks
)

module.exports = router