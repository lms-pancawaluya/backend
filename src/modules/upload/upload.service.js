// src/modules/upload/upload.service.js

const supabase = require('../../config/supabase')
const exifr = require('exifr')

// ================================================
// HELPER — Validasi metadata tanggal foto
// ================================================
const validasiTanggalFoto = async (fileBuffer) => {
  try {
    const metadata = await exifr.parse(fileBuffer)

    // Kalau tidak ada metadata EXIF
    // (foto dari WhatsApp, screenshot, dll)
    if (!metadata || !metadata.DateTimeOriginal) {
      return {
        valid: true,
        hasMetadata: false,
        pesan: 'Foto tidak memiliki metadata tanggal — diterima tapi ditandai'
      }
    }

    const tanggalFoto = new Date(metadata.DateTimeOriginal)
    const hariIni = new Date()

    // Cek apakah foto diambil hari ini
    const samaTanggal =
      tanggalFoto.getFullYear() === hariIni.getFullYear() &&
      tanggalFoto.getMonth() === hariIni.getMonth() &&
      tanggalFoto.getDate() === hariIni.getDate()

    if (!samaTanggal) {
      return {
        valid: false,
        hasMetadata: true,
        tanggalFoto: tanggalFoto.toISOString(),
        pesan: `Foto harus diambil hari ini. Foto ini diambil pada: ${tanggalFoto.toLocaleDateString('id-ID')}`
      }
    }

    return {
      valid: true,
      hasMetadata: true,
      tanggalFoto: tanggalFoto.toISOString(),
      pesan: 'Foto valid'
    }

  } catch (error) {
    // Kalau gagal baca metadata → tetap izinkan
    return {
      valid: true,
      hasMetadata: false,
      pesan: 'Tidak bisa membaca metadata foto'
    }
  }
}

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
// UPLOAD FOTO BUKTI CHECKLIST
// ================================================
const uploadFotoBukti = async (file, userId) => {
  // 1. Validasi metadata tanggal foto
  const validasi = await validasiTanggalFoto(file.buffer)

  if (!validasi.valid) {
    throw new Error(validasi.pesan)
  }

  // 2. Upload ke Supabase Storage
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

  // 3. Return URL + info metadata
  return {
    fotoUrl: urlData.publicUrl,
    hasMetadata: validasi.hasMetadata,
    tanggalFoto: validasi.tanggalFoto || null,
    pesan: validasi.pesan
  }
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