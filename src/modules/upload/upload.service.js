// src/modules/upload/upload.service.js

const supabase = require('../../config/supabase')
const exifr = require('exifr')

// ================================================
// HELPER — Validasi metadata tanggal foto (KETAT)
// ================================================
const validasiTanggalFoto = async (fileBuffer) => {
  try {
    const metadata = await exifr.parse(fileBuffer, ['DateTimeOriginal', 'latitude', 'longitude'])

    // 1. TOLAK jika foto tidak punya metadata EXIF (foto WhatsApp, screenshot, dll)
    if (!metadata || !metadata.DateTimeOriginal) {
      return {
        valid: false,
        hasMetadata: false,
        pesan: 'Foto tidak memiliki metadata tanggal. Harap ambil foto secara langsung menggunakan kamera HP (bukan screenshot atau kiriman WhatsApp)!'
      }
    }

    const tanggalFoto = new Date(metadata.DateTimeOriginal)
    const hariIni = new Date()

    // 2. Cek apakah foto diambil HARI INI
    const samaTanggal =
      tanggalFoto.getFullYear() === hariIni.getFullYear() &&
      tanggalFoto.getMonth() === hariIni.getMonth() &&
      tanggalFoto.getDate() === hariIni.getDate()

    // TOLAK jika foto bukan diambil hari ini
    if (!samaTanggal) {
      const tanggalFormatted = tanggalFoto.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
      return {
        valid: false,
        hasMetadata: true,
        tanggalFoto: tanggalFoto.toISOString(),
        pesan: `Foto tidak valid! Foto ini diambil pada ${tanggalFormatted}. Kamu wajib menggunakan foto yang diambil hari ini.`
      }
    }

    // 3. LOLOS — Foto diambil hari ini & punya metadata
    return {
      valid: true,
      hasMetadata: true,
      tanggalFoto: tanggalFoto.toISOString(),
      latitude: metadata.latitude || null,
      longitude: metadata.longitude || null,
      pesan: 'Foto valid'
    }

  } catch (error) {
    // TOLAK jika file korup / metadata tidak bisa dibaca
    return {
      valid: false,
      hasMetadata: false,
      pesan: 'Gagal membaca metadata foto. Pastikan file berupa gambar JPG/PNG asli dari kamera.'
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
  // 1. Validasi metadata tanggal foto (Akan throw error jika valid: false)
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
    latitude: validasi.latitude || null,
    longitude: validasi.longitude || null,
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