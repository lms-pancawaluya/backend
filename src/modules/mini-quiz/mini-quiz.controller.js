// src/modules/mini-quiz/mini-quiz.controller.js

const miniQuizService = require('./mini-quiz.service')

// ================================================
// GET MINI QUIZ BY CONTENT
// ================================================
const getMiniQuizByContent = async (req, res) => {
  try {
    const { contentId } = req.params
    const miniQuiz = await miniQuizService.getMiniQuizByContent(contentId)

    // Kalau tidak ada mini kuis, return null (bukan error)
    if (!miniQuiz) {
      return res.status(200).json({
        sukses: true,
        adaMiniKuis: false,
        data: null
      })
    }

    return res.status(200).json({
      sukses: true,
      adaMiniKuis: true,
      data: miniQuiz
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE MINI QUIZ — Admin buat mini kuis
// ================================================
const createMiniQuiz = async (req, res) => {
  try {
    const { contentId } = req.params
    const { judul, passingScore, maxAttempts } = req.body

    if (!judul) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul mini kuis wajib diisi'
      })
    }

    if (passingScore && (passingScore < 1 || passingScore > 100)) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Passing score harus antara 1-100'
      })
    }

    if (maxAttempts && maxAttempts < 1) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Maksimal percobaan minimal 1'
      })
    }

    const miniQuizBaru = await miniQuizService.createMiniQuiz(
      contentId,
      { judul, passingScore, maxAttempts }
    )

    return res.status(201).json({
      sukses: true,
      pesan: 'Mini kuis berhasil dibuat',
      data: miniQuizBaru
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE QUESTION — Admin tambah soal
// ================================================
const createQuestion = async (req, res) => {
  try {
    const { id } = req.params
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
        pesan: 'Soal harus memiliki minimal 2 pilihan jawaban'
      })
    }

    const adaJawabanBenar = options.some(opt => opt.isCorrect === true)
    if (!adaJawabanBenar) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Harus ada minimal 1 jawaban yang benar'
      })
    }

    const questionBaru = await miniQuizService.createQuestion(id, {
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
// GET MY ATTEMPTS — Riwayat percobaan guru
// ================================================
const getMyAttempts = async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    const hasil = await miniQuizService.getMyAttempts(userId, id)

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

// ================================================
// SUBMIT ATTEMPT — Guru kerjakan mini kuis
// ================================================
const submitAttempt = async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    const { jawaban } = req.body

    // Validasi jawaban
    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Jawaban harus berupa array dan tidak boleh kosong'
      })
    }

    // Setiap jawaban harus punya questionId dan optionId
    const jawabanValid = jawaban.every(
      item => item.questionId && item.optionId
    )

    if (!jawabanValid) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Setiap jawaban harus memiliki questionId dan optionId'
      })
    }

    const hasil = await miniQuizService.submitAttempt(userId, id, { jawaban })

    return res.status(200).json({
      sukses: true,
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
// CHECK CONTENT LOCK — Cek apakah konten terkunci
// ================================================
const checkContentLock = async (req, res) => {
  try {
    const userId = req.user.id
    const { contentId } = req.params

    const hasil = await miniQuizService.checkContentLock(userId, contentId)

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

module.exports = {
  getMiniQuizByContent,
  createMiniQuiz,
  createQuestion,
  getMyAttempts,
  submitAttempt,
  checkContentLock
}