// src/modules/evaluations/evaluations.controller.js

const evaluationsService = require('./evaluations.service')

// ================================================
// GET EVALUATIONS BY MODULE
// ================================================
const getEvaluationsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params
    const evaluations = await evaluationsService.getEvaluationsByModule(moduleId)

    return res.status(200).json({
      sukses: true,
      jumlah: evaluations.length,
      data: evaluations
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET EVALUATION BY ID + SOAL
// ================================================
const getEvaluationById = async (req, res) => {
  try {
    const { id } = req.params
    const evaluation = await evaluationsService.getEvaluationById(id)

    return res.status(200).json({
      sukses: true,
      data: evaluation
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// CREATE EVALUATION — Hanya admin
// ================================================
const createEvaluation = async (req, res) => {
  try {
    const { moduleId } = req.params
    const { judul } = req.body

    if (!judul) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Judul evaluasi wajib diisi'
      })
    }

    const evaluationBaru = await evaluationsService.createEvaluation(
      moduleId,
      { judul }
    )

    return res.status(201).json({
      sukses: true,
      pesan: 'Evaluasi berhasil dibuat',
      data: evaluationBaru
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
    const { id } = req.params
    const { pertanyaan, tipe, options } = req.body

    // Validasi field wajib
    if (!pertanyaan || !tipe) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Pertanyaan dan tipe wajib diisi'
      })
    }

    // Validasi tipe soal
    const tipeValid = ['pilihan_ganda', 'esai']
    if (!tipeValid.includes(tipe)) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Tipe soal harus "pilihan_ganda" atau "esai"'
      })
    }

    // Kalau pilihan ganda, options wajib diisi
    if (tipe === 'pilihan_ganda' && (!options || options.length < 2)) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Soal pilihan ganda wajib memiliki minimal 2 pilihan jawaban'
      })
    }

    const questionBaru = await evaluationsService.createQuestion(id, {
      pertanyaan,
      tipe,
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
// SUBMIT JAWABAN — Guru submit jawaban
// ================================================
const submitJawaban = async (req, res) => {
  try {
    const { id } = req.params
    const { jawaban } = req.body
    const userId = req.user.id

    // Validasi jawaban harus array dan tidak kosong
    if (!jawaban || !Array.isArray(jawaban) || jawaban.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Jawaban harus berupa array dan tidak boleh kosong'
      })
    }

    // Validasi setiap item jawaban harus punya questionId dan jawaban
    const jawabanValid = jawaban.every(
      item => item.questionId && item.jawaban
    )

    if (!jawabanValid) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Setiap jawaban harus memiliki questionId dan jawaban'
      })
    }

    const hasil = await evaluationsService.submitJawaban(id, userId, { jawaban })

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
// GET ANSWERS — Admin lihat semua jawaban
// ================================================
const getAnswersByEvaluation = async (req, res) => {
  try {
    const { id } = req.params
    const answers = await evaluationsService.getAnswersByEvaluation(id)

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
// GET MY ANSWERS — Guru lihat jawaban sendiri
// ================================================
const getMyAnswers = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const hasil = await evaluationsService.getMyAnswers(id, userId)

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
  getEvaluationsByModule,
  getEvaluationById,
  createEvaluation,
  createQuestion,
  submitJawaban,
  getAnswersByEvaluation,
  getMyAnswers 
}