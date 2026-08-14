// src/modules/upload/upload.controller.js

const uploadService = require('./upload.service')
const prisma = require('../../config/database')

// ================================================
// UPLOAD FOTO PROFIL
// ================================================
const uploadFotoProfil = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Tidak ada file yang diupload'
      })
    }

    const userId = req.user.id

    // Upload ke Supabase Storage
    const fotoUrl = await uploadService.uploadFotoProfil(req.file, userId)

    // Update fotoProfil di database
    await prisma.user.update({
      where: { id: userId },
      data: { fotoProfil: fotoUrl }
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Foto profil berhasil diupload',
      data: { fotoUrl }
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPLOAD FOTO BUKTI CHECKLIST
// ================================================
const uploadFotoBukti = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Tidak ada file yang diupload'
      })
    }

    const userId = req.user.id

    // Upload ke Supabase Storage + validasi metadata
    const hasil = await uploadService.uploadFotoBukti(req.file, userId)

    return res.status(200).json({
      sukses: true,
      pesan: 'Foto bukti berhasil diupload',
      data: {
        fotoUrl: hasil.fotoUrl,
        hasMetadata: hasil.hasMetadata,
        tanggalFoto: hasil.tanggalFoto,
        pesan: hasil.pesan
      }
    })

  } catch (error) {
    // Kalau foto tidak valid (bukan foto hari ini)
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  uploadFotoProfil,
  uploadFotoBukti
}