// src/modules/comments/comments.routes.js

const express = require('express')
const router = express.Router()
const commentController = require('./comments.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

// Endpoint pencarian user untuk autocomplete @mention (ditaruh sebelum route params)
router.get('/users/search', authMiddleware, commentController.getMentionableUsers)

// Semua endpoint komentar butuh login (authMiddleware)
router.post('/', authMiddleware, commentController.createComment)

// Get komentar via Query string (contoh: /comments?courseId=xxx)
router.get('/', authMiddleware, commentController.getComments)

// Get komentar via Route params (Course atau Module)
router.get('/course/:courseId', authMiddleware, commentController.getComments)
router.get('/module/:moduleId', authMiddleware, commentController.getComments)

router.delete('/:id', authMiddleware, commentController.deleteComment)

module.exports = router