// src/modules/upload/upload.route.js

const express = require('express')
const router = express.Router()
const multer = require('multer')
const uploadController = require('./upload.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

// ================================================
// Setup Multer — simpan file di memory (buffer)
// ================================================
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  // Hanya izinkan file gambar
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true) // izinkan
  } else {
    cb(new Error('Hanya file JPG, PNG, dan WebP yang diizinkan'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // maksimal 5MB
  }
})

// ================================================
// POST upload foto profil
// ================================================
router.post('/foto-profil',
  authMiddleware,
  upload.single('foto'), // 'foto' = nama field di form
  uploadController.uploadFotoProfil
)

// ================================================
// POST upload foto bukti checklist
// ================================================
router.post('/foto-bukti',
  authMiddleware,
  upload.single('foto'),
  uploadController.uploadFotoBukti
)

module.exports = router