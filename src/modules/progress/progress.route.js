// src/modules/progress/progress.route.js

const express = require('express')
const router = express.Router()
const progressController = require('./progress.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// GET progress guru sendiri
router.get('/',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.getProgress
)

// GET ringkasan progress semua modul
router.get('/summary',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.getSummary
)

// POST mulai modul
router.post('/:moduleId/start',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.startModule
)

// POST selesaikan modul
router.post('/:moduleId/complete',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.completeModule
)

// POST tandai material/konten selesai
router.post('/contents/:contentId/complete',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.markContentComplete
)

// POST update progress material
router.post('/contents/:contentId/progress',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.updateContentProgress
)

// GET progress satu modul spesifik
router.get('/:moduleId',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  progressController.getProgressByModule
)

module.exports = router