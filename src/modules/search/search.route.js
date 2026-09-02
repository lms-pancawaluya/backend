const express = require('express')
const router = express.Router()
const searchController = require('./search.controller')
const { verifyToken } = require('../../middlewares/auth.middleware') // Sesuaikan path middleware auth kamu

// Endpoint Search Global: GET /api/search?q=keyword
router.get('/', verifyToken, searchController.handleGlobalSearch)

module.exports = router