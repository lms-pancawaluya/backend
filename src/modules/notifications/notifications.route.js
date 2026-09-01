const express = require('express')
const router = express.Router()
const notificationController = require('./notifications.controller')
const authMiddleware = require('../../middlewares/auth.middleware') // 

// Proteksi seluruh route notifikasi dengan middleware Auth
router.use(authMiddleware)

// 1. Route Statis
router.get('/', notificationController.getMyNotifications)
router.get('/unread-count', notificationController.getUnreadCount)
router.patch('/read-all', notificationController.markAllAsRead)

// 2. Route Dinamis
router.patch('/:id/read', notificationController.markAsRead)

module.exports = router