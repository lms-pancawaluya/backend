const express = require('express');
const router = express.Router();
const coursesController = require('./courses.controller');

// Import Middleware
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

// ==========================================
// ROUTES UNTUK SEMUA USER TERAUTENTIKASI
// (Guru/Siswa, Pengajar, dan Admin dapat melihat)
// ==========================================
router.get('/', authMiddleware, coursesController.getAll);
router.get('/:id', authMiddleware, coursesController.getById);

// ==========================================
// ROUTES KHUSUS PENGELOLA (Admin & Pengajar)
// (Guru TIDAK memilik hak akses untuk CUD)
// ==========================================
router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  coursesController.create
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  coursesController.update
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'), // Hapus course disarankan hanya untuk Admin
  coursesController.delete
);

module.exports = router;