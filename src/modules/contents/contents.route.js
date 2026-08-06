// src/modules/contents/contents.route.js

const express = require('express')
const router = express.Router({ mergeParams: true })
const contentsController = require('./contents.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// GET semua konten di modul — Admin & Guru
// ================================================
router.get('/',
  authMiddleware,
  contentsController.getContentsByModule
)

// ================================================
// POST tambah konten — Hanya admin
// ================================================
router.post('/',
  authMiddleware,
  roleMiddleware('admin'),
  contentsController.createContent
)

// ================================================
// PUT update konten — Hanya admin
// ================================================
router.put('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  contentsController.updateContent
)

// ================================================
// DELETE hapus konten — Hanya admin
// ================================================
router.delete('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  contentsController.deleteContent
)

module.exports = router