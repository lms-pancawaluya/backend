const express = require('express')
const router = express.Router()

const adminMonitoringController = require('./admin-monitoring.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// Endpoint Bulk Progress Semua Guru (Wajib di atas route dengan param :userId)
router.get(
  '/users/progress/all',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  adminMonitoringController.getAllUsersLearningProgress
)

// Endpoint Progress Detail Per Guru
router.get(
  '/users/:userId/progress',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  adminMonitoringController.getUserLearningProgress
)

// Endpoint Evaluasi Per Guru
router.get(
  '/users/:userId/evaluations',
  authMiddleware,
  roleMiddleware('admin', 'pengajar'),
  adminMonitoringController.getUserEvaluations
)

module.exports = router