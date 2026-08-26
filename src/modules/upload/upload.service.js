const supabase = require('../../config/supabase')

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
    .from('rtl-files') // Pastikan nama bucket di Supabase kamu 'rtl-files' atau sesuaikan
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
  deleteFile
}