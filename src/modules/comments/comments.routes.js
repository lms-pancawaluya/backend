// src/modules/comments/comments.routes.js

const express = require('express')
const router = express.Router()
const commentController = require('./comments.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

// Endpoint pencarian user untuk autocomplete @mention (wajib ditaruh sebelum route params /:id)
router.get('/users/search', authMiddleware, commentController.getMentionableUsers)

// Tambah komentar baru (Bisa courseId, moduleId, parentId, & mentionedUserIds)
router.post('/', authMiddleware, commentController.createComment)

// Get komentar via Query String (contoh: /comments?courseId=xxx)
router.get('/', authMiddleware, commentController.getComments)

// Get komentar via Route Params (Course atau Module)
router.get('/course/:courseId', authMiddleware, commentController.getComments)
router.get('/module/:moduleId', authMiddleware, commentController.getComments)

// Hapus komentar
router.delete('/:id', authMiddleware, commentController.deleteComment)

module.exports = router