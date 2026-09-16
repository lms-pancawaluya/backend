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

module.exports = {
  getMyCertificates,
  getCertificateById,
  claimCertificate
}
