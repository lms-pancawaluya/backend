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
  roleMiddleware('admin', 'guru'),
  checklistController.getTodayChecklist
)

// POST submit checklist hari ini — Guru
router.post('/today',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  checklistController.submitChecklist
)

// GET riwayat checklist — Guru
router.get('/history',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  checklistController.getChecklistHistory
)

// ================================================
// REPORT & BUKTI — Admin lihat rekap & foto bukti
// ================================================

// GET rekap konsistensi semua guru — Admin only
router.get('/report',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.getChecklistReport
)

// GET foto bukti checklist guru — Admin only
router.get('/foto-bukti',
  authMiddleware,
  roleMiddleware('admin'),
  checklistController.getFotoBukti
)

module.exports = router