// src/modules/modules/modules.controller.js

const modulesService = require('./modules.service')

const getAllModules = async (req, res) => {
  try {
    const modules = await modulesService.getAllModules(req.query)

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

const createModule = async (req, res) => {
  try {
    const { courseId, judul, deskripsi, aspekPancawaluya, urutan } = req.body

    if (!judul || !deskripsi || !urutan) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul, deskripsi, dan urutan wajib diisi'
      })
    }

    if (aspekPancawaluya) {
      const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer', 'umum']
      if (!aspekValid.includes(aspekPancawaluya)) {
        return res.status(400).json({
          sukses: false,
          pesan: `Aspek Pancawaluya harus salah satu dari: ${aspekValid.join(', ')}`
        })
      }
    }

    const moduleBaru = await modulesService.createModule({
      courseId,
      judul,
      deskripsi,
      aspekPancawaluya,
      urutan: Number(urutan)
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

const updateModule = async (req, res) => {
  try {
    const { id } = req.params
    const { courseId, judul, deskripsi, aspekPancawaluya, urutan } = req.body

    if (aspekPancawaluya) {
      const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer', 'umum']
      if (!aspekValid.includes(aspekPancawaluya)) {
        return res.status(400).json({
          sukses: false,
          pesan: `Aspek Pancawaluya harus salah satu dari: ${aspekValid.join(', ')}`
        })
      }
    }

    const moduleUpdated = await modulesService.updateModule(id, {
      courseId,
      judul,
      deskripsi,
      aspekPancawaluya,
      urutan: urutan ? Number(urutan) : undefined
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