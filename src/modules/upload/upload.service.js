// src/modules/upload/upload.service.js

const supabase = require('../../config/supabase')

// ================================================
// UPLOAD FOTO PROFIL
// ================================================
const uploadFotoProfil = async (file, userId) => {
  // Buat nama file unik pakai userId + timestamp
  const fileExt = file.originalname.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `profil/${fileName}`

  // Upload ke Supabase Storage bucket foto-profil
  const { data, error } = await supabase.storage
    .from('foto-profil')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: true // kalau sudah ada, timpa
    })

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`)
  }

  // Ambil URL publik foto
  const { data: urlData } = supabase.storage
    .from('foto-profil')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

// ================================================
// UPLOAD FOTO BUKTI CHECKLIST
// ================================================
const uploadFotoBukti = async (file, userId) => {
  const fileExt = file.originalname.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `bukti/${fileName}`

  const { data, error } = await supabase.storage
    .from('bukti-checklist')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    })

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('bukti-checklist')
    .getPublicUrl(filePath)

  return urlData.publicUrl
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
  uploadFotoBukti,
  deleteFile
}