const express = require('express')
const router = express.Router()
const multer = require('multer')
const uploadController = require('./upload.controller')
const authMiddleware = require('../../middlewares/auth.middleware')

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf' // Diizinkan untuk Dokumen RTL & Modul LMS
  ]

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Hanya file Gambar (JPG, PNG, WebP) atau PDF yang diizinkan'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Max 10MB
  }
})

// POST upload foto profil
router.post('/foto-profil',
  authMiddleware,
  upload.single('foto'),
  uploadController.uploadFotoProfil
)

// POST upload file PDF RTL
router.post('/rtl',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadRtl
)

// POST upload file PDF Modul LMS (Cloudinary)
router.post('/pdf',
  authMiddleware,
  upload.single('file'),
  uploadController.uploadPdfModul
)

module.exports = router