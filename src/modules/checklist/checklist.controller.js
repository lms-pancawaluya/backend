// src/modules/checklist/checklist.controller.js

const checklistService = require('./checklist.service')

// ================================================
// GET CHECKLIST ITEMS — Semua template item
// ================================================
const getChecklistItems = async (req, res) => {
  try {
    const items = await checklistService.getChecklistItems()
    return res.status(200).json({
      sukses: true,
      jumlah: items.length,
      data: items
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE CHECKLIST ITEM — Admin buat item baru
// ================================================
const createChecklistItem = async (req, res) => {
  try {
    const { aspek, deskripsi, urutan } = req.body

    if (!aspek || !deskripsi || !urutan) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Aspek, deskripsi, dan urutan wajib diisi'
      })
    }

    const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer']
    if (!aspekValid.includes(aspek)) {
      return res.status(400).json({
        sukses: false,
        pesan: `Aspek harus salah satu dari: ${aspekValid.join(', ')}`
      })
    }

    const itemBaru = await checklistService.createChecklistItem({
      aspek,
      deskripsi,
      urutan
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Item checklist berhasil dibuat',
      data: itemBaru
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE CHECKLIST ITEM — Admin update item
// ================================================
const updateChecklistItem = async (req, res) => {
  try {
    const { id } = req.params
    const { aspek, deskripsi, urutan, isActive } = req.body

    if (aspek) {
      const aspekValid = ['cageur', 'bageur', 'bener', 'pinter', 'singer']
      if (!aspekValid.includes(aspek)) {
        return res.status(400).json({
          sukses: false,
          pesan: `Aspek harus salah satu dari: ${aspekValid.join(', ')}`
        })
      }
    }

    const itemUpdated = await checklistService.updateChecklistItem(id, {
      aspek,
      deskripsi,
      urutan,
      isActive
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Item checklist berhasil diupdate',
      data: itemUpdated
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE CHECKLIST ITEM — Admin hapus item
// ================================================
const deleteChecklistItem = async (req, res) => {
  try {
    const { id } = req.params
    const hasil = await checklistService.deleteChecklistItem(id)

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

// ================================================
// GET TODAY CHECKLIST — Checklist hari ini
// ================================================
const getTodayChecklist = async (req, res) => {
  try {
    const userId = req.user.id
    const hasil = await checklistService.getTodayChecklist(userId)

    return res.status(200).json({
      sukses: true,
      data: hasil
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// SUBMIT CHECKLIST — Guru submit checklist hari ini
// ================================================
const submitChecklist = async (req, res) => {
  try {
    const userId = req.user.id
    const { items } = req.body

    // Validasi items harus array dan tidak kosong
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Items harus berupa array dan tidak boleh kosong'
      })
    }

    // Validasi setiap item harus punya checklistItemId
    const itemsValid = items.every(item => item.checklistItemId)
    if (!itemsValid) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Setiap item harus memiliki checklistItemId'
      })
    }

    const hasil = await checklistService.submitChecklist(userId, { items })

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan,
      data: { totalDisimpan: hasil.totalDisimpan }
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET HISTORY — Riwayat checklist guru
// ================================================
const getChecklistHistory = async (req, res) => {
  try {
    const userId = req.user.id
    const days = parseInt(req.query.days) || 7

    const history = await checklistService.getChecklistHistory(userId, days)

    return res.status(200).json({
      sukses: true,
      data: history
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET REPORT — Admin lihat rekap konsistensi
// ================================================
const getChecklistReport = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7
    const report = await checklistService.getChecklistReport(days)

    return res.status(200).json({
      sukses: true,
      data: report
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getTodayChecklist,
  submitChecklist,
  getChecklistHistory,
  getChecklistReport
}