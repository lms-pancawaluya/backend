const express = require('express')
const router = express.Router()
const searchController = require('./search.controller')
const authMiddleware = require('../../middlewares/auth.middleware') 

// Endpoint Search Global: GET /api/search?q=keyword
router.get('/', authMiddleware, searchController.handleGlobalSearch)

module.exports = router