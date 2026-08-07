// src/modules/progress/progress.controller.js

const progressService = require('./progress.service')

// ================================================
// GET PROGRESS — Ambil semua progress guru
// ================================================
const getProgress = async (req, res) => {
  try {
    const userId = req.user.id

    const progress = await progressService.getProgress(userId)

    return res.status(200).json({
      sukses: true,
      jumlah: progress.length,
      data: progress
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET SUMMARY — Ringkasan progress semua modul
// ================================================
const getSummary = async (req, res) => {
  try {
    const userId = req.user.id

    const summary = await progressService.getSummary(userId)

    return res.status(200).json({
      sukses: true,
      data: summary
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// START MODULE — Mulai belajar modul
// ================================================
const startModule = async (req, res) => {
  try {
    const userId = req.user.id
    const { moduleId } = req.params

    const progress = await progressService.startModule(userId, moduleId)

    return res.status(200).json({
      sukses: true,
      pesan: 'Modul berhasil dimulai',
      data: progress
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// COMPLETE MODULE — Tandai modul selesai
// ================================================
const completeModule = async (req, res) => {
  try {
    const userId = req.user.id
    const { moduleId } = req.params

    const progress = await progressService.completeModule(userId, moduleId)

    return res.status(200).json({
      sukses: true,
      pesan: 'Selamat! Modul berhasil diselesaikan 🎉',
      data: progress
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET PROGRESS BY MODULE — Cek progress satu modul
// ================================================
const getProgressByModule = async (req, res) => {
  try {
    const userId = req.user.id
    const { moduleId } = req.params

    const progress = await progressService.getProgressByModule(userId, moduleId)

    return res.status(200).json({
      sukses: true,
      data: progress
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getProgress,
  getSummary,
  startModule,
  completeModule,
  getProgressByModule
}