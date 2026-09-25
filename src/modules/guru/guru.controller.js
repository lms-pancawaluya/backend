// src/modules/guru/guru.controller.js

const guruService = require('./guru.service')

const cekNip = async (req, res, next) => {
  try {
    const { nip } = req.params

    if (!nip) {
      return res.status(400).json({
        sukses: false,
        pesan: 'NIP wajib diisi'
      })
    }

    const guru = await guruService.findGuruByNip(nip)

    if (!guru) {
      return res.status(404).json({
        sukses: false,
        pesan: 'Data NIP tidak ditemukan di master data. Silakan isi data sekolah secara manual.'
      })
    }

    return res.status(200).json({
      sukses: true,
      pesan: 'Data NIP berhasil ditemukan',
      data: {
        namaGuru: guru.namaGuru,
        npsnSekolah: guru.npsnSekolah,
        namaSekolah: guru.namaSekolah,
        kotaKab: guru.kotaKab,
        kecamatan: guru.kecamatan
      }
    })
  } catch (error) {
    next(error)
  }
}

const searchSekolah = async (req, res, next) => {
  try {
    const { q } = req.query

    // Jika keyword kosong atau kurang dari 3 karakter, kembalikan array kosong
    if (!q || q.trim().length < 3) {
      return res.status(200).json({
        sukses: true,
        pesan: q ? 'Keyword pencarian minimal 3 karakter' : 'Keyword pencarian kosong',
        data: []
      })
    }

    const sekolahList = await guruService.searchSekolahByName(q)

    return res.status(200).json({
      sukses: true,
      pesan: 'Berhasil mendapatkan data sekolah',
      data: sekolahList
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  cekNip,
  searchSekolah
}