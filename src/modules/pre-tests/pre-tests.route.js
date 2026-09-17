// src/modules/pre-tests/pre-tests.route.js
//
// Route domain Pre-Test.
// Ter-mount di `/api/modules/:moduleId/pre-tests` (mergeParams: true),
// sehingga `:moduleId` tersedia dari parent router.

const express = require('express')
const router = express.Router({ mergeParams: true })
const preTestsController = require('./pre-tests.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// GET pre-test di modul — Admin & Guru
// ================================================
router.get('/',
  authMiddleware,
  preTestsController.getPreTestsByModule
)

// ================================================
// POST buat pre-test — Hanya admin
// ================================================
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.createPreTest
)

// ================================================
// PUT update soal — Hanya admin
// (harus didahulukan agar tidak bentrok dengan '/:preTestId')
// ================================================
router.put('/questions/:questionId',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.updateQuestion
)

// ================================================
// DELETE hapus soal — Hanya admin
// ================================================
router.delete('/questions/:questionId',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.deleteQuestion
)

// ================================================
// GET detail pre-test + soal — Admin & Guru
// ================================================
router.get('/:preTestId',
  authMiddleware,
  preTestsController.getPreTestById
)

// ================================================
// DELETE hapus pre-test — Hanya admin
// ================================================
router.delete('/:preTestId',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.deletePreTest
)

// ================================================
// POST tambah soal ke pre-test — Hanya admin
// ================================================
router.post('/:preTestId/questions',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.createQuestion
)

// ================================================
// POST submit jawaban pre-test — Hanya guru
// ================================================
router.post('/:preTestId/submit',
  authMiddleware,
  roleMiddleware('guru'),
  preTestsController.submitPreTest
)

// ================================================
// GET semua jawaban di pre-test — Hanya admin
// ================================================
router.get('/:preTestId/answers',
  authMiddleware,
  roleMiddleware('admin'),
  preTestsController.getAnswersByPreTest
)

// ================================================
// GET jawaban saya sendiri — Guru
// ================================================
router.get('/:preTestId/my-answers',
  authMiddleware,
  preTestsController.getMyAnswers
)

module.exports = router
