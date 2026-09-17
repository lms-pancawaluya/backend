// src/modules/post-tests/post-tests.route.js
//
// Route domain Post-Test.
// Ter-mount di `/api/modules/:moduleId/post-tests` (mergeParams: true),
// sehingga `:moduleId` tersedia dari parent router.

const express = require('express')
const router = express.Router({ mergeParams: true })
const postTestsController = require('./post-tests.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// GET post-test di modul — Admin & Guru
// ================================================
router.get('/',
  authMiddleware,
  postTestsController.getPostTestsByModule
)

// ================================================
// POST buat post-test — Hanya admin
// ================================================
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.createPostTest
)

// ================================================
// PUT update soal — Hanya admin
// (harus didahulukan agar tidak bentrok dengan '/:postTestId')
// ================================================
router.put('/questions/:questionId',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.updateQuestion
)

// ================================================
// DELETE hapus soal — Hanya admin
// ================================================
router.delete('/questions/:questionId',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.deleteQuestion
)

// ================================================
// GET detail post-test + soal — Admin & Guru
// ================================================
router.get('/:postTestId',
  authMiddleware,
  postTestsController.getPostTestById
)

// ================================================
// DELETE hapus post-test — Hanya admin
// ================================================
router.delete('/:postTestId',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.deletePostTest
)

// ================================================
// POST tambah soal ke post-test — Hanya admin
// ================================================
router.post('/:postTestId/questions',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.createQuestion
)

// ================================================
// POST submit jawaban post-test — Hanya guru
// ================================================
router.post('/:postTestId/submit',
  authMiddleware,
  roleMiddleware('guru'),
  postTestsController.submitPostTest
)

// ================================================
// GET semua jawaban di post-test — Hanya admin
// ================================================
router.get('/:postTestId/answers',
  authMiddleware,
  roleMiddleware('admin'),
  postTestsController.getAnswersByPostTest
)

// ================================================
// GET jawaban saya sendiri — Guru
// ================================================
router.get('/:postTestId/my-answers',
  authMiddleware,
  postTestsController.getMyAnswers
)

module.exports = router
