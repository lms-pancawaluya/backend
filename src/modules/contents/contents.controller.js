// src/modules/contents/contents.controller.js

const contentsService = require('./contents.service')

// ================================================
// GET ALL CONTENTS BY MODULE
// ================================================
const getContentsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params

    const contents = await contentsService.getContentsByModule(moduleId)

    return res.status(200).json({
      sukses: true,
      jumlah: contents.length,
      data: contents
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE CONTENT — Hanya admin
// ================================================
const createContent = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { judul, tipe, konten, urutan } = req.body

    // Validasi semua field wajib diisi
    if (!judul || !tipe || !konten || !urutan) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul, tipe, konten, dan urutan wajib diisi'
      })
    }

    // Validasi tipe harus teks atau video
    const tipeValid = ['teks', 'video']
    if (!tipeValid.includes(tipe)) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Tipe konten harus "teks" atau "video"'
      })
    }

    // Validasi kalau tipe video, konten harus URL YouTube
    if (tipe === 'video' && !konten.includes('youtube.com') && !konten.includes('youtu.be')) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Konten video harus berupa URL YouTube yang valid'
      })
    }

    const contentBaru = await contentsService.createContent(moduleId, {
      judul,
      tipe,
      konten,
      urutan
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Konten berhasil ditambahkan',
      data: contentBaru
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE CONTENT — Hanya admin
// ================================================
const updateContent = async (req, res) => {
  try {
    const { id } = req.params
    const { judul, tipe, konten, urutan } = req.body

    // Validasi tipe kalau dikirim
    if (tipe) {
      const tipeValid = ['teks', 'video']
      if (!tipeValid.includes(tipe)) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Tipe konten harus "teks" atau "video"'
        })
      }
    }

    // Validasi URL YouTube kalau tipe video
    if (tipe === 'video' && konten) {
      if (!konten.includes('youtube.com') && !konten.includes('youtu.be')) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Konten video harus berupa URL YouTube yang valid'
        })
      }
    }

    const contentUpdated = await contentsService.updateContent(id, {
      judul,
      tipe,
      konten,
      urutan
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Konten berhasil diupdate',
      data: contentUpdated
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE CONTENT — Hanya admin
// ================================================
const deleteContent = async (req, res) => {
  try {
    const { id } = req.params
    const hasil = await contentsService.deleteContent(id)

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
  getContentsByModule,
  createContent,
  updateContent,
  deleteContent
}