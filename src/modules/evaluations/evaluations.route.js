// src/modules/evaluations/evaluations.route.js

const express = require('express')
const router = express.Router({ mergeParams: true })
const evaluationsController = require('./evaluations.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// GET evaluasi di modul — Admin & Guru
// ================================================
router.get('/',
  authMiddleware,
  evaluationsController.getEvaluationsByModule
)

// ================================================
// GET detail evaluasi + soal — Admin & Guru
// ================================================
router.get('/:id',
  authMiddleware,
  evaluationsController.getEvaluationById
)

// ================================================
// POST buat evaluasi — Hanya admin
// ================================================
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  evaluationsController.createEvaluation
)

// ================================================
// POST tambah soal ke evaluasi — Hanya admin
// ================================================
router.post('/:id/questions',
  authMiddleware,
  roleMiddleware('admin'),
  evaluationsController.createQuestion
)

// ================================================
// POST submit jawaban — Hanya guru
// ================================================
router.post('/:id/submit',
  authMiddleware,
  roleMiddleware('guru'),
  evaluationsController.submitJawaban
)

module.exports = router