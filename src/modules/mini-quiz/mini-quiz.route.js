// src/modules/mini-quiz/mini-quiz.route.js

const express = require('express')
const router = express.Router()

const miniQuizController = require('./mini-quiz.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// 1. ROUTE BERBASIS KONTEN (:contentId)
// ================================================

// GET mini kuis berdasarkan ID Konten — Admin & Guru
// GET /api/mini-quizzes/content/:contentId
router.get(
  '/content/:contentId',
  authMiddleware,
  miniQuizController.getMiniQuizByContent
)

// POST buat mini kuis baru pada Konten tertentu — Admin only
// POST /api/mini-quizzes/content/:contentId
router.post(
  '/content/:contentId',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.createMiniQuiz
)

// GET cek apakah konten berikutnya terkunci — Admin & Guru
// GET /api/mini-quizzes/content/:contentId/check-lock
router.get(
  '/content/:contentId/check-lock',
  authMiddleware,
  miniQuizController.checkContentLock
)

// ================================================
// 2. ROUTE KELOLA SOAL / QUESTION (:id = questionId)
// ================================================

// PUT edit 1 butir soal — Admin only
// PUT /api/mini-quizzes/questions/:id
router.put(
  '/questions/:id',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.updateQuestion
)

// DELETE hapus 1 butir soal — Admin only
// DELETE /api/mini-quizzes/questions/:id
router.delete(
  '/questions/:id',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.deleteQuestion
)

// ================================================
// 3. ROUTE BERBASIS MINI QUIZ (:id = miniQuizId)
// ================================================

// PUT edit header mini kuis — Admin only
// PUT /api/mini-quizzes/:id
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.updateMiniQuiz
)

// DELETE hapus mini kuis beserta seluruh soalnya — Admin only
// DELETE /api/mini-quizzes/:id
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  miniQuizController.deleteMiniQuiz
)

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
  roleMiddleware('guru', 'pengajar'),
  miniQuizController.getMyAttempts
)

// POST submit jawaban mini kuis 
// POST /api/mini-quizzes/:id/attempt
router.post(
  '/:id/attempt',
  authMiddleware,
  roleMiddleware('guru', 'pengajar'),
  miniQuizController.submitAttempt
)

module.exports = router