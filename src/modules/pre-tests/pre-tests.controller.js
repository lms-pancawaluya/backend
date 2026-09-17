// src/modules/pre-tests/pre-tests.controller.js

const preTestsService = require('./pre-tests.service')

// ================================================
// GET PRE-TEST DI MODUL
// ================================================
const getPreTestsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params
    const preTests = await preTestsService.getPreTestsByModule(moduleId)

    return res.status(200).json({
      sukses: true,
      jumlah: preTests.length,
      data: preTests
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET PRE-TEST BY ID + SOAL
// ================================================
const getPreTestById = async (req, res) => {
  try {
    const { preTestId } = req.params
    const preTest = await preTestsService.getPreTestById(preTestId)

    return res.status(200).json({
      sukses: true,
      data: preTest
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE PRE-TEST — Hanya admin
// ================================================
const createPreTest = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { judul } = req.body

    if (!judul) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul evaluasi wajib diisi'
      })
    }

    const preTestBaru = await preTestsService.createPreTest(moduleId, { judul })

    return res.status(201).json({
      sukses: true,
      pesan: 'Pre-Test berhasil dibuat',
      data: preTestBaru
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE QUESTION — Hanya admin
// ================================================
const createQuestion = async (req, res) => {
  try {
    const { preTestId } = req.params
    const { pertanyaan, options } = req.body

    if (!pertanyaan) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Pertanyaan wajib diisi'
      })
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Soal pilihan ganda wajib memiliki minimal 2 pilihan jawaban'
      })
    }

    const questionBaru = await preTestsService.createQuestion(preTestId, {
      pertanyaan,
      options
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Soal berhasil ditambahkan',
      data: questionBaru
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE QUESTION — Hanya admin
// ================================================
const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params
    const { pertanyaan, options } = req.body

    const updatedQuestion = await preTestsService.updateQuestion(questionId, {
      pertanyaan,
      options
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Soal evaluasi berhasil diperbarui',
      data: updatedQuestion
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE QUESTION — Hanya admin
// ================================================
const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params
    const result = await preTestsService.deleteQuestion(questionId)

    return res.status(200).json({
      sukses: true,
      pesan: result.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE PRE-TEST — Hanya admin
// ================================================
const deletePreTest = async (req, res) => {
  try {
    const { moduleId, preTestId } = req.params
    const result = await preTestsService.deletePreTest(moduleId, preTestId)

    return res.status(200).json({
      sukses: true,
      pesan: result.pesan
    })
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// SUBMIT JAWABAN PRE-TEST — Guru
// ================================================
const submitPreTest = async (req, res) => {
  try {
    const { preTestId } = req.params
    const { jawaban } = req.body
    const userId = req.user.id

    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Jawaban harus berupa array dan tidak boleh kosong'
      })
    }

    const jawabanValid = jawaban.every(
      item => item.questionId && item.jawaban
    )

    if (!jawabanValid) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Setiap jawaban harus memiliki questionId dan jawaban'
      })
    }

    const hasil = await preTestsService.submitPreTest(preTestId, userId, { jawaban })

    return res.status(200).json({
      sukses: true,
      pesan: 'Jawaban berhasil disubmit',
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET ANSWERS — Admin
// ================================================
const getAnswersByPreTest = async (req, res) => {
  try {
    const { preTestId } = req.params
    const answers = await preTestsService.getAnswersByPreTest(preTestId)

    return res.status(200).json({
      sukses: true,
      jumlah: answers.length,
      data: answers
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET MY ANSWERS — Guru
// ================================================
const getMyAnswers = async (req, res) => {
  try {
    const { preTestId } = req.params
    const userId = req.user.id

    const hasil = await preTestsService.getMyAnswers(preTestId, userId)

    return res.status(200).json({
      sukses: true,
      data: hasil
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getPreTestsByModule,
  getPreTestById,
  createPreTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deletePreTest,
  submitPreTest,
  getAnswersByPreTest,
  getMyAnswers
}
