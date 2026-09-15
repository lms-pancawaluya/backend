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
    const fotoUrl = await uploadService.uploadFotoProfil(req.file, userId)

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
// UPLOAD DOKUMEN RTL (PDF)
// ================================================
const uploadRtl = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sukses: false,
        pesan: 'File PDF RTL wajib diunggah'
      })
    }

    const userId = req.user.id
    const filePdfUrl = await uploadService.uploadRtl(req.file, userId)

    return res.status(200).json({
      sukses: true,
      pesan: 'File PDF RTL berhasil diupload',
      data: { filePdfUrl }
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPLOAD PDF MODUL LMS (CLOUDINARY)
// ================================================
const uploadPdfModul = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        sukses: false,
        pesan: 'File PDF modul wajib diunggah'
      })
    }

    const pdfUrl = await uploadService.uploadPdfModul(req.file)

    return res.status(200).json({
      sukses: true,
      pesan: 'File PDF modul berhasil diunggah ke Cloudinary',
      data: { url: pdfUrl }
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  uploadFotoProfil,
  uploadRtl,
  uploadPdfModul
}