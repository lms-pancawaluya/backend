// src/modules/modules/modules.route.js

const express = require('express')
const router = express.Router()
const modulesController = require('./modules.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')
const contentsRoute = require('../contents/contents.route')

// ================================================
// Nested route — contents di dalam modules
// ================================================
router.use('/:moduleId/contents', contentsRoute)

// ================================================
// PUBLIC ROUTES — Semua user yang sudah login
// ================================================

// GET /api/modules — Admin & Guru bisa lihat semua modul
router.get('/',
  authMiddleware,
  modulesController.getAllModules
)

// GET /api/modules/:id — Admin & Guru bisa lihat detail modul
router.get('/:id',
  authMiddleware,
  modulesController.getModuleById
)

// ================================================
// ADMIN ONLY ROUTES
// ================================================

// POST /api/modules — Hanya admin buat modul baru
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  modulesController.createModule
)

// PUT /api/modules/:id — Hanya admin update modul
router.put('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  modulesController.updateModule
)

// DELETE /api/modules/:id — Hanya admin hapus modul
router.delete('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  modulesController.deleteModule
)

module.exports = router