const guruService = require('./guru.service')

const cekNip = async (req, res, next) => {
  try {
    const { nip } = req.params

    if (!nip) {
      return res.status(400).json({
        success: false,
        message: 'NIP wajib diisi'
      })
    }

    const guru = await guruService.findGuruByNip(nip)

    if (!guru) {
      return res.status(404).json({
        success: false,
        message: 'Data NIP tidak ditemukan di master data. Silakan isi data sekolah secara manual.'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Data NIP berhasil ditemukan',
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

    if (!q) {
      return res.status(200).json({
        success: true,
        data: []
      })
    }

    const sekolahList = await guruService.searchSekolahByName(q)

    return res.status(200).json({
      success: true,
      message: 'Berhasil mendapatkan data sekolah',
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