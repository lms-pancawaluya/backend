// src/modules/checklist/checklist.route.js

const express = require('express')
const router = express.Router()
const checklistController = require('./checklist.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// CHECKLIST ITEMS — Template item (Admin kelola)
// ================================================

// GET semua template item — Admin & Guru
router.get('/items',
  authMiddleware,
  checklistController.getChecklistItems
)

// POST buat item baru — Admin only
router.post('/items',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.createChecklistItem
)

// PUT update item — Admin only
router.put('/items/:id',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.updateChecklistItem
)

// DELETE hapus item — Admin only
router.delete('/items/:id',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.deleteChecklistItem
)

// ================================================
// DAILY CHECKLIST — Isian harian guru
// ================================================

// GET checklist hari ini — Guru
router.get('/today',
  authMiddleware,
  roleMiddleware('guru'),
  checklistController.getTodayChecklist
)

// POST submit checklist hari ini — Guru
router.post('/today',
  authMiddleware,
  roleMiddleware('guru'),
  checklistController.submitChecklist
)

// GET riwayat checklist — Guru
router.get('/history',
  authMiddleware,
  roleMiddleware('guru'),
  checklistController.getChecklistHistory
)

// ================================================
// REPORT — Admin lihat rekap konsistensi
// ================================================

// GET rekap konsistensi semua guru — Admin only
router.get('/report',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.getChecklistReport
)

module.exports = router