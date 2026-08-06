// src/modules/modules/modules.controller.js

const modulesService = require('./modules.service')

// ================================================
// GET ALL MODULES
// ================================================
const getAllModules = async (req, res) => {
  try {
    const modules = await modulesService.getAllModules()

    return res.status(200).json({
      sukses: true,
      jumlah: modules.length,
      data: modules
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET MODULE BY ID
// ================================================
const getModuleById = async (req, res) => {
  try {
    const { id } = req.params
    const module = await modulesService.getModuleById(id)

    return res.status(200).json({
      sukses: true,
      data: module
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE MODULE — Hanya admin
// ================================================
const createModule = async (req, res) => {
  try {
    const { judul, deskripsi, aspekPancawaluya, urutan } = req.body

    // Validasi semua field wajib diisi
    if (!judul || !deskripsi || !aspekPancawaluya || !urutan) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul, deskripsi, aspek Pancawaluya, dan urutan wajib diisi'
      })
    }

    // Validasi aspekPancawaluya harus salah satu dari 5 aspek
    const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer']
    if (!aspekValid.includes(aspekPancawaluya)) {
      return res.status(400).json({
        sukses: false,
        pesan: `Aspek Pancawaluya harus salah satu dari: ${aspekValid.join(', ')}`
      })
    }

    // Validasi urutan harus angka 1-5
    if (urutan < 1 || urutan > 5) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Urutan harus antara 1 sampai 5'
      })
    }

    const moduleBaru = await modulesService.createModule({
      judul,
      deskripsi,
      aspekPancawaluya,
      urutan
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Modul berhasil dibuat',
      data: moduleBaru
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE MODULE — Hanya admin
// ================================================
const updateModule = async (req, res) => {
  try {
    const { id } = req.params
    const { judul, deskripsi, aspekPancawaluya, urutan } = req.body

    // Validasi aspek kalau dikirim
    if (aspekPancawaluya) {
      const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer']
      if (!aspekValid.includes(aspekPancawaluya)) {
        return res.status(400).json({
          sukses: false,
          pesan: `Aspek Pancawaluya harus salah satu dari: ${aspekValid.join(', ')}`
        })
      }
    }

    // Validasi urutan kalau dikirim
    if (urutan && (urutan < 1 || urutan > 5)) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Urutan harus antara 1 sampai 5'
      })
    }

    const moduleUpdated = await modulesService.updateModule(id, {
      judul,
      deskripsi,
      aspekPancawaluya,
      urutan
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Modul berhasil diupdate',
      data: moduleUpdated
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE MODULE — Hanya admin
// ================================================
const deleteModule = async (req, res) => {
  try {
    const { id } = req.params
    const hasil = await modulesService.deleteModule(id)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getAllModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule
}