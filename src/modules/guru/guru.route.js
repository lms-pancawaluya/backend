const express = require('express')
const router = express.Router()
const guruController = require('./guru.controller')

// GET /api/guru/cek-nip/198501012010011001
router.get('/cek-nip/:nip', guruController.cekNip)

// GET /api/guru/cari-sekolah?q=Baleendah
router.get('/cari-sekolah', guruController.searchSekolah)

module.exports = router