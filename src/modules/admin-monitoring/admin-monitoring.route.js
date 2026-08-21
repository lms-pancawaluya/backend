const express = require('express')
const router = express.Router()

const adminMonitoringController = require('./admin-monitoring.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// Hanya Admin yang bisa akses
router.get(
  '/users/:userId/progress',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  adminMonitoringController.getUserModuleProgress
)

router.get(
  '/users/:userId/evaluations',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  adminMonitoringController.getUserEvaluations
)

module.exports = router