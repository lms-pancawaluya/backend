// src/modules/mini-quiz/mini-quiz.route.js

const express = require('express')
const router = express.Router({ mergeParams: true })
const miniQuizController = require('./mini-quiz.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// GET mini kuis by konten — Admin & Guru
// ================================================
router.get('/',
  authMiddleware,
  miniQuizController.getMiniQuizByContent
)

// ================================================
// POST buat mini kuis — Admin only 
// ================================================
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.createMiniQuiz
)

// ================================================
// POST tambah soal — Admin only
// ================================================
router.post('/:id/questions',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.createQuestion
)

// ================================================
// GET riwayat percobaan — Guru
// ================================================
router.get('/:id/my-attempts',
  authMiddleware,
  roleMiddleware('guru'),
  miniQuizController.getMyAttempts
)

// ================================================
// POST submit jawaban — Guru
// ================================================
router.post('/:id/attempt',
  authMiddleware,
  roleMiddleware('guru'),
  miniQuizController.submitAttempt
)

// ================================================
// GET cek apakah konten terkunci — Admin & Guru
// ================================================
router.get('/check-lock/:contentId',
  authMiddleware,
  miniQuizController.checkContentLock
)

module.exports = router