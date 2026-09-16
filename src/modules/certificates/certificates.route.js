// src/modules/certificates/certificates.route.js

const express = require('express')
const router = express.Router()
const certificatesController = require('./certificates.controller')
const authMiddleware = require('../../middlewares/auth.middleware')
const roleMiddleware = require('../../middlewares/role.middleware')

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
// GET detail satu sertifikat milik user
// ================================================
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'guru'),
  certificatesController.getCertificateById
)

module.exports = router
