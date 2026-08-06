// src/modules/users/users.route.js

const express = require('express')
const router = express.Router()
const usersController = require('./users.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// Semua route users butuh login (authMiddleware)
// ================================================

// GET /api/users — Hanya admin
router.get('/',
  authMiddleware,
  roleMiddleware('admin'),
  usersController.getAllUsers
)

// GET /api/users/:id — Admin & guru (guru hanya lihat diri sendiri)
router.get('/:id',
  authMiddleware,
  usersController.getUserById
)

// PUT /api/users/:id — Admin & guru (guru hanya update diri sendiri)
router.put('/:id',
  authMiddleware,
  usersController.updateUser
)

// DELETE /api/users/:id — Hanya admin
router.delete('/:id',
  authMiddleware,
  roleMiddleware('admin'),
  usersController.deleteUser
)

module.exports = router