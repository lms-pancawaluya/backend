// src/modules/mini-quiz/mini-quiz.controller.js

const miniQuizService = require('./mini-quiz.service')

// ================================================
// GET MINI QUIZ BY CONTENT
// ================================================
const getMiniQuizByContent = async (req, res) => {
  try {
    const { contentId } = req.params
    const miniQuizzes = await miniQuizService.getMiniQuizByContent(contentId)

    if (!miniQuizzes || miniQuizzes.length === 0) {
      return res.status(200).json({
        sukses: true,
        adaMiniKuis: false,
        totalKuis: 0,
        data: []
      })
    }

    return res.status(200).json({
      sukses: true,
      adaMiniKuis: true,
      totalKuis: miniQuizzes.length,
      data: miniQuizzes
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
    const { judul, passingScore, maxAttempts, timestampSeconds } = req.body

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

    if (timestampSeconds !== undefined && timestampSeconds !== null && timestampSeconds < 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Timestamp video tidak boleh bernilai negatif'
      })
    }

    const miniQuizBaru = await miniQuizService.createMiniQuiz(
      contentId,
      { judul, passingScore, maxAttempts, timestampSeconds }
    )

    return res.status(201).json({
      sukses: true,
      pesan: 'Mini kuis berhasil dibuat',
      data: miniQuizBaru
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE MINI QUIZ — Admin edit header mini kuis
// ================================================
const updateMiniQuiz = async (req, res) => {
  try {
    const { id } = req.params // miniQuizId
    const { judul, passingScore, maxAttempts, timestampSeconds } = req.body

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

    if (timestampSeconds !== undefined && timestampSeconds !== null && timestampSeconds < 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Timestamp video tidak boleh bernilai negatif'
      })
    }

    const updatedMiniQuiz = await miniQuizService.updateMiniQuiz(id, {
      judul,
      passingScore,
      maxAttempts,
      timestampSeconds
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Mini kuis berhasil diperbarui',
      data: updatedMiniQuiz
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE MINI QUIZ — Admin hapus mini kuis
// ================================================
const deleteMiniQuiz = async (req, res) => {
  try {
    const { id } = req.params // miniQuizId
    const hasil = await miniQuizService.deleteMiniQuiz(id)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
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
    const { id } = req.params // miniQuizId
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
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE QUESTION — Admin edit soal
// ================================================
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params // questionId
    const { pertanyaan, options } = req.body

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
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
    }

    const updatedQuestion = await miniQuizService.updateQuestion(id, {
      pertanyaan,
      options
    })

    return res.status(200).json({
      sukses: true,
      pesan: 'Soal berhasil diperbarui',
      data: updatedQuestion
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE QUESTION — Admin hapus soal
// ================================================
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params // questionId
    const hasil = await miniQuizService.deleteQuestion(id)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
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
    const { id } = req.params // miniQuizId

    const hasil = await miniQuizService.getMyAttempts(userId, id)

    return res.status(200).json({
      sukses: true,
      data: hasil
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
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
    const { id } = req.params // miniQuizId
    const { jawaban } = req.body

    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Jawaban harus berupa array dan tidak boleh kosong'
      })
    }

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
      pesan: hasil.pesan,
      data: hasil
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400
    return res.status(statusCode).json({
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
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getMiniQuizByContent,
  createMiniQuiz,
  updateMiniQuiz,
  deleteMiniQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getMyAttempts,
  submitAttempt,
  checkContentLock
}