// src/modules/auth/auth.route.js

const express = require('express')
const router = express.Router()
const authController = require('./auth.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// PUBLIC ROUTES — Tidak butuh login
// ================================================

// Register Mandiri (Guru Reguler - Pakai OTP) & Verification
router.post('/register', authController.register)
router.post('/verify-otp', authController.verifyOtp)
router.post('/resend-otp', authController.resendOtp)

// Login (Email ATAU NIP)
router.post('/login', authController.login)

// Forgot Password & Reset Password (Guru Mandiri)
router.post('/forgot-password', authController.forgotPassword)
router.post('/verify-reset-otp', authController.verifyResetOtp)
router.post('/reset-password', authController.resetPassword)

// ================================================
// PROTECTED ROUTES — Butuh login
// ================================================

// Register Guru (HANYA Oleh Admin / Pengajar)
router.post('/register-guru', 
  authMiddleware, 
  roleMiddleware('admin', 'pengajar'), 
  authController.registerGuru
)

// GET /api/auth/me (Get profile user login)
router.get('/me', authMiddleware, authController.getMe)

// PUT /api/auth/admin/reset-password/:userId (HANYA Khusus Admin)
router.put('/admin/reset-password/:userId', 
  authMiddleware, 
  roleMiddleware('admin'), 
  authController.adminResetPassword
)

module.exports = router