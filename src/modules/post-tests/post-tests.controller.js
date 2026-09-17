// src/modules/post-tests/post-tests.controller.js

const postTestsService = require('./post-tests.service')

// ================================================
// GET POST-TEST DI MODUL
// ================================================
const getPostTestsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params
    const postTests = await postTestsService.getPostTestsByModule(moduleId)

    return res.status(200).json({
      sukses: true,
      jumlah: postTests.length,
      data: postTests
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET POST-TEST BY ID + SOAL
// ================================================
const getPostTestById = async (req, res) => {
  try {
    const { postTestId } = req.params
    const postTest = await postTestsService.getPostTestById(postTestId)

    return res.status(200).json({
      sukses: true,
      data: postTest
    })
  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE POST-TEST — Hanya admin
// ================================================
const createPostTest = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { judul, passingScore, maxAttempts } = req.body

    if (!judul) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul evaluasi wajib diisi'
      })
    }

    const postTestBaru = await postTestsService.createPostTest(moduleId, {
      judul,
      passingScore,
      maxAttempts
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Post-Test berhasil dibuat',
      data: postTestBaru
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
    const { postTestId } = req.params
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

    const questionBaru = await postTestsService.createQuestion(postTestId, {
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

    const updatedQuestion = await postTestsService.updateQuestion(questionId, {
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
    const result = await postTestsService.deleteQuestion(questionId)

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
// DELETE POST-TEST — Hanya admin
// ================================================
const deletePostTest = async (req, res) => {
  try {
    const { moduleId, postTestId } = req.params
    const result = await postTestsService.deletePostTest(moduleId, postTestId)

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
// SUBMIT JAWABAN POST-TEST — Guru
// ================================================
const submitPostTest = async (req, res) => {
  try {
    const { postTestId } = req.params
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

    const hasil = await postTestsService.submitPostTest(postTestId, userId, { jawaban })

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
const getAnswersByPostTest = async (req, res) => {
  try {
    const { postTestId } = req.params
    const answers = await postTestsService.getAnswersByPostTest(postTestId)

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
    const { postTestId } = req.params
    const userId = req.user.id

    const hasil = await postTestsService.getMyAnswers(postTestId, userId)

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
  getPostTestsByModule,
  getPostTestById,
  createPostTest,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deletePostTest,
  submitPostTest,
  getAnswersByPostTest,
  getMyAnswers
}
