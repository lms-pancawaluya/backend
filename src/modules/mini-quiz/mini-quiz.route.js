// src/modules/mini-quiz/mini-quiz.route.js

const express = require('express')
const router = express.Router()

const miniQuizController = require('./mini-quiz.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// ROUTE BERBASIS KONTEN (:contentId)
// ================================================

// GET mini kuis berdasarkan ID Konten — Admin & Guru
// GET /api/mini-quizzes/content/:contentId
router.get(
  '/content/:contentId',
  authMiddleware,
  miniQuizController.getMiniQuizByContent
)

// POST buat mini kuis pada Konten tertentu — Admin only
// POST /api/mini-quizzes/content/:contentId
router.post(
  '/content/:contentId',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.createMiniQuiz
)

// GET cek apakah konten berikutnya terkunci — Admin & Guru
// GET /api/mini-quizzes/check-lock/:contentId
router.get(
  '/check-lock/:contentId',
  authMiddleware,
  miniQuizController.checkContentLock
)

// ================================================
// ROUTE BERBASIS MINI QUIZ (:id)
// ================================================

// POST tambah soal ke mini kuis — Admin only
// POST /api/mini-quizzes/:id/questions
router.post(
  '/:id/questions',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.createQuestion
)

// GET riwayat percobaan guru pada mini kuis ini — Guru
// GET /api/mini-quizzes/:id/my-attempts
router.get(
  '/:id/my-attempts',
  authMiddleware,
  roleMiddleware('guru'),
  miniQuizController.getMyAttempts
)

// POST submit jawaban mini kuis — Guru
// POST /api/mini-quizzes/:id/attempt
router.post(
  '/:id/attempt',
  authMiddleware,
  roleMiddleware('guru'),
  miniQuizController.submitAttempt
)

module.exports = router