// src/modules/certificates/certificates.route.js

const express = require('express')
const router = express.Router()
const multer = require('multer')
const certificatesController = require('./certificates.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

// ================================================
// Upload template (PDF) — memory storage, mengikuti
// pola upload.route.js (file diteruskan sebagai buffer).
// ================================================
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Template sertifikat wajib berformat PDF'), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // Max 10MB
  }
})

// ================================================
// GET semua sertifikat milik user saat ini
// ================================================
router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.getMyCertificates
)

// ================================================
// POST klaim sertifikat untuk sebuah course
// (harus di atas '/:id' agar 'claim' tidak
// dianggap sebagai certificate id)
// ================================================
router.post(
  '/:courseId/claim',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.claimCertificate
)

// ================================================
// Template certificate per course.
// (harus di atas '/:id' agar tidak dianggap id)
// ================================================
router.post(
  '/:courseId/template',
  authMiddleware,
  roleMiddleware('admin'),
  upload.single('file'),
  certificatesController.uploadCertificateTemplate
)

router.get(
  '/:courseId/template',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.getCertificateTemplate
)

// ================================================
// Generate PDF certificate personal
// (harus di atas '/:id')
// ================================================
router.post(
  '/:id/generate',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.generateCertificate
)

// ================================================
// GET detail satu sertifikat milik user
// ================================================
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.getCertificateById
)

module.exports = router
