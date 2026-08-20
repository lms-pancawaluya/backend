const express = require('express')
const router = express.Router()
const rtlController = require('./rtl.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// Endpoint Guru
router.post('/upload', authMiddleware, rtlController.uploadRtl)
router.get('/module/:moduleId', authMiddleware, rtlController.getRtlByModule)

// Endpoint Pengajar & Admin
router.get('/submissions', authMiddleware, roleMiddleware('pengajar', 'admin'), rtlController.getAllRtlSubmissions)
router.patch('/:rtlId/review', authMiddleware, roleMiddleware('pengajar', 'admin'), rtlController.reviewRtl)

module.exports = router