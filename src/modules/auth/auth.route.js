// src/modules/auth/auth.route.js

const express = require('express')
const router = express.Router()
const authController = require('./auth.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

// ================================================
// PUBLIC ROUTES — Tidak butuh login
// ================================================

// POST /api/auth/register
router.post('/register', authController.register)

// POST /api/auth/login
router.post('/login', authController.login)

// ================================================
// PROTECTED ROUTES — Butuh login
// ================================================

// GET /api/auth/me
// authMiddleware dipasang → wajib login dulu
router.get('/me', authMiddleware, authController.getMe)

module.exports = router