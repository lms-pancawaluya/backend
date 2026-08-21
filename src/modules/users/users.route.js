const express = require('express')
const router = express.Router()
const usersController = require('./users.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// Semua route users butuh login (authMiddleware)
// ================================================

// GET /api/users — Admin & Pengajar (Bisa pakai filter ?sekolah=...&kotaKab=...&kecamatan=...)
router.get('/',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  usersController.getAllUsers
)

// ================================================
// PROFILE ROUTES — Ditaruh di atas sebelum /:id
// ================================================
router.get('/profile/me',
  authMiddleware,
  usersController.getMyProfile
)

router.put('/profile/me',
  authMiddleware,
  usersController.updateMyProfile
)

router.put('/profile/me/password',
  authMiddleware,
  usersController.updatePassword
)

// ================================================
// ID ROUTES (Dipasang di bawah)
// ================================================
router.get('/:id',
  authMiddleware,
  usersController.getUserById
)

// UPDATE: Admin & Pengajar bisa mengubah data user lain (misal: Pengajar ubah lokasi Guru)
router.put('/:id',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  usersController.updateUser
)

router.delete('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  usersController.deleteUser
)

router.put('/:id/reset-password',
  authMiddleware,
  roleMiddleware('admin'),
  usersController.adminResetPassword
)

module.exports = router