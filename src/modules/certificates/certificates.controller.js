// src/modules/certificates/certificates.controller.js

const certificateService = require('./certificates.service')

// ================================================
// GET MY CERTIFICATES — Sertifikat milik user
// ================================================
const getMyCertificates = async (req, res) => {
  try {
    const userId = req.user.id

    const certificates = await certificateService.getMyCertificates(userId)

    return res.status(200).json({
      sukses: true,
      jumlah: certificates.length,
      data: certificates
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET CERTIFICATE BY ID — Detail satu sertifikat
// ================================================
const getCertificateById = async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params

    const certificate = await certificateService.getCertificateById(id, user)

    return res.status(200).json({
      sukses: true,
      data: certificate
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CLAIM CERTIFICATE — Klaim sertifikat sebuah course
//
// Idempotent. Status pada response:
// - created         -> sertifikat baru dibuat
// - already_claimed -> sudah pernah dibuat, return existing
// - 400             -> course belum 100%
// ================================================
const claimCertificate = async (req, res) => {
  try {
    const userId = req.user.id
    const { courseId } = req.params

    const hasil = await certificateService.claimCertificate(userId, courseId)

    const pesan =
      hasil.status === 'created'
        ? 'Sertifikat berhasil dibuat'
        : 'Sertifikat sudah pernah diklaim'

    return res.status(200).json({
      sukses: true,
      pesan,
      status: hasil.status,
      data: hasil.certificate
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPLOAD / UPDATE TEMPLATE CERTIFICATE COURSE
//
// Admin (atau pengelola berhak) meng-upload template
// PDF untuk sebuah course. Template disimpan di
// storage existing (Cloudinary), bukan local disk.
// ================================================
const uploadCertificateTemplate = async (req, res) => {
  try {
    const user = req.user
    const { courseId } = req.params

    if (!req.file) {
      return res.status(400).json({
        sukses: false,
        pesan: 'File template PDF wajib diunggah'
      })
    }

    const data = await certificateService.uploadCertificateTemplate(
      courseId,
      req.file,
      user
    )

    return res.status(200).json({
      sukses: true,
      pesan: 'Template sertifikat berhasil diunggah',
      data
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET TEMPLATE CERTIFICATE COURSE
// ================================================
const getCertificateTemplate = async (req, res) => {
  try {
    const user = req.user
    const { courseId } = req.params

    const data = await certificateService.getCertificateTemplate(
      courseId,
      user
    )

    return res.status(200).json({
      sukses: true,
      data
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GENERATE CERTIFICATE (PDF personal)
//
// Status pada response:
// - generated         -> PDF baru dibuat
// - already_generated -> fileUrl sudah ada, tidak digenerate ulang
// - 400               -> course belum memiliki template
// ================================================
const generateCertificate = async (req, res) => {
  try {
    const user = req.user
    const { id } = req.params
    const force = req.query.force === 'true'

    const hasil = await certificateService.generateCertificate(
      id,
      user,
      { force }
    )

    const pesan =
      hasil.status === 'generated'
        ? 'Sertifikat berhasil digenerate'
        : 'Sertifikat sudah pernah digenerate'

    return res.status(200).json({
      sukses: true,
      pesan,
      status: hasil.status,
      data: hasil.certificate
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getMyCertificates,
  getCertificateById,
  claimCertificate,
  uploadCertificateTemplate,
  getCertificateTemplate,
  generateCertificate
}
