const supabase = require('../../config/supabase')
const cloudinary = require('cloudinary').v2 // 1. Import Cloudinary

// Panggil config agar membaca CLOUDINARY_URL di .env
cloudinary.config()

// ================================================
// UPLOAD FOTO PROFIL
// ================================================
const uploadFotoProfil = async (file, userId) => {
  const fileExt = file.originalname.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `profil/${fileName}`

  const { data, error } = await supabase.storage
    .from('foto-profil')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    })

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('foto-profil')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

// ================================================
// UPLOAD DOKUMEN RTL (PDF)
// ================================================
const uploadRtl = async (file, userId) => {
  if (file.mimetype !== 'application/pdf') {
    throw new Error('Dokumen RTL wajib berformat PDF!')
  }

  const fileName = `rtl-${userId}-${Date.now()}.pdf`
  const filePath = `documents/${fileName}`

  const { data, error } = await supabase.storage
    .from('rtl-files')
    .upload(filePath, file.buffer, {
      contentType: 'application/pdf',
      upsert: false
    })

  if (error) {
    throw new Error(`Upload RTL gagal: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('rtl-files')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

// ================================================
// UPLOAD PDF MODUL LMS (CLOUDINARY) — [BARU]
// ================================================
const uploadPdfModul = async (file) => {
  if (file.mimetype !== 'application/pdf') {
    throw new Error('File modul wajib berformat PDF!')
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'lms-pdf-docs',
        resource_type: 'raw' // 'raw' agar Cloudinary menyimpan & menyajikan file PDF asli
      },
      (error, result) => {
        if (error) return reject(new Error(`Upload Cloudinary gagal: ${error.message}`))
        resolve(result.secure_url) // Kembalikan Direct URL PDF
      }
    )
    stream.end(file.buffer)
  })
}

// ================================================
// UPLOAD TEMPLATE SERTIFIKAT (PDF) — Cloudinary
//
// Template PDF hasil export Canva yang di-upload admin.
// Disimpan di folder terpisah dari sertifikat personal.
// Mengembalikan { url, publicId } agar Course dapat
// menyimpan referensi template-nya.
// ================================================
const uploadCertificateTemplate = async (file, courseId) => {
  if (file.mimetype !== 'application/pdf') {
    throw new Error('Template sertifikat wajib berformat PDF!')
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'lms-certificate-templates',
        resource_type: 'raw',
        public_id: `template-${courseId}`,
        overwrite: true
      },
      (error, result) => {
        if (error) {
          return reject(
            new Error(`Upload template gagal: ${error.message}`)
          )
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id
        })
      }
    )
    stream.end(file.buffer)
  })
}

// ================================================
// UPLOAD SERTIFIKAT PERSONAL (PDF) — Cloudinary
//
// Hasil generate PDF personal per certificate.
// public_id memakai nomor sertifikat agar unik.
// ================================================
const uploadCertificateFile = async (pdfBuffer, certificateNumber) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'lms-certificates',
        resource_type: 'raw',
        public_id: `certificate-${certificateNumber}`,
        overwrite: true
      },
      (error, result) => {
        if (error) {
          return reject(
            new Error(`Upload sertifikat gagal: ${error.message}`)
          )
        }
        resolve(result.secure_url)
      }
    )
    stream.end(pdfBuffer)
  })
}

// ================================================
// DOWNLOAD FILE (Buffer) dari URL
//
// Dipakai untuk mengambil template PDF dari Cloudinary
// sebelum di-render. Node 18+ menyediakan fetch global.
// ================================================
const downloadFileBuffer = async (url) => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil file (${response.status})`
    )
  }

  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

// ================================================
// DELETE FILE dari Storage
// ================================================
const deleteFile = async (bucket, filePath) => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath])

  if (error) {
    throw new Error(`Hapus file gagal: ${error.message}`)
  }

  return { pesan: 'File berhasil dihapus' }
}

module.exports = {
  uploadFotoProfil,
  uploadRtl,
  uploadPdfModul, // Export fungsi baru
  uploadCertificateTemplate,
  uploadCertificateFile,
  downloadFileBuffer,
  deleteFile
}