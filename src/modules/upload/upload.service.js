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
  deleteFile
}