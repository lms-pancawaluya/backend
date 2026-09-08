// src/modules/modules/modules.route.js

const express = require('express')
const router = express.Router()
const modulesController = require('./modules.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')
const contentsRoute = require('../contents/contents.route')
const evaluationsRoute = require('../evaluations/evaluations.route')

// Nested routes
router.use('/:moduleId/contents', contentsRoute)
router.use('/:moduleId/evaluations', evaluationsRoute)

// PUBLIC / GENERAL ROUTES
router.get('/', authMiddleware, modulesController.getAllModules)
router.get('/:id', authMiddleware, modulesController.getModuleById)

// PENGELOLA ROUTES (Admin & Pengajar)
router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  modulesController.createModule
)

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  modulesController.updateModule
)

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'), // Hapus modul sebaiknya tetap Admin
  modulesController.deleteModule
)

module.exports = router