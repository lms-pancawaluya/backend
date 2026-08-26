const express = require('express')
const router = express.Router()
const commentController = require('./comments.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

// Semua endpoint komentar butuh login (authMiddleware)
router.post('/', authMiddleware, commentController.createComment)
router.get('/module/:moduleId', authMiddleware, commentController.getCommentsByModule)
router.delete('/:id', authMiddleware, commentController.deleteComment)

module.exports = router