// src/modules/mini-quiz/mini-quiz.service.js

const prisma = require('../../config/database')

// ================================================
// GET MINI QUIZ BY CONTENT — Ambil mini kuis
// ================================================
const getMiniQuizByContent = async (contentId) => {
  const miniQuiz = await prisma.miniQuiz.findUnique({
    where: { contentId },
    select: {
      id: true,
      judul: true,
      passingScore: true,
      maxAttempts: true,
      createdAt: true,
      questions: {
        select: {
          id: true,
          pertanyaan: true,
          options: {
            select: {
              id: true,
              teksOpsi: true
              // isCorrect disembunyikan dari guru
            }
          }
        }
      }
    }
  })

  if (!miniQuiz) {
    return null // konten ini tidak punya mini kuis
  }

  return miniQuiz
}

// ================================================
// CREATE MINI QUIZ — Admin buat mini kuis
// ================================================
const createMiniQuiz = async (contentId, data) => {
  const { judul, passingScore, maxAttempts } = data

  // Cek apakah konten ada
  const contentAda = await prisma.content.findUnique({
    where: { id: contentId }
  })

  if (!contentAda) {
    throw new Error('Konten tidak ditemukan')
  }

  // Cek apakah konten sudah punya mini kuis
  const sudahAda = await prisma.miniQuiz.findUnique({
    where: { contentId }
  })

  if (sudahAda) {
    throw new Error('Konten ini sudah memiliki mini kuis')
  }

  const miniQuizBaru = await prisma.miniQuiz.create({
    data: {
      contentId,
      judul,
      passingScore: passingScore || 80,
      maxAttempts: maxAttempts || 3
    }
  })

  return miniQuizBaru
}

// ================================================
// CREATE QUESTION — Admin tambah soal ke mini kuis
// ================================================
const createQuestion = async (miniQuizId, data) => {
  const { pertanyaan, options } = data

  const miniQuizAda = await prisma.miniQuiz.findUnique({
    where: { id: miniQuizId }
  })

  if (!miniQuizAda) {
    throw new Error('Mini kuis tidak ditemukan')
  }

  // Validasi options
  if (!options || options.length < 2) {
    throw new Error('Soal harus memiliki minimal 2 pilihan jawaban')
  }

  const adaJawabanBenar = options.some(opt => opt.isCorrect === true)
  if (!adaJawabanBenar) {
    throw new Error('Harus ada minimal 1 jawaban yang benar')
  }

  const questionBaru = await prisma.miniQuizQuestion.create({
    data: {
      miniQuizId,
      pertanyaan,
      options: {
        create: options.map(opt => ({
          teksOpsi: opt.teksOpsi,
          isCorrect: opt.isCorrect || false
        }))
      }
    },
    include: { options: true }
  })

  return questionBaru
}

// ================================================
// GET MY ATTEMPTS — Lihat riwayat percobaan guru
// ================================================
const getMyAttempts = async (userId, miniQuizId) => {
  const attempts = await prisma.miniQuizAttempt.findMany({
    where: { userId, miniQuizId },
    orderBy: { attemptNumber: 'asc' }
  })

  const miniQuiz = await prisma.miniQuiz.findUnique({
    where: { id: miniQuizId },
    select: { maxAttempts: true, passingScore: true }
  })

  if (!miniQuiz) {
    throw new Error('Mini kuis tidak ditemukan')
  }

  const sudahLulus = attempts.some(a => a.isPassed)
  const jumlahPercobaan = attempts.length
  const sisaPercobaan = miniQuiz.maxAttempts - jumlahPercobaan

  return {
    sudahLulus,
    jumlahPercobaan,
    sisaPercobaan: sisaPercobaan < 0 ? 0 : sisaPercobaan,
    maxAttempts: miniQuiz.maxAttempts,
    passingScore: miniQuiz.passingScore,
    attempts
  }
}

// ================================================
// SUBMIT ATTEMPT — Guru kerjakan mini kuis
// ================================================
const submitAttempt = async (userId, miniQuizId, data) => {
  const { jawaban } = data

  const miniQuiz = await prisma.miniQuiz.findUnique({
    where: { id: miniQuizId },
    include: {
      questions: {
        include: { options: true }
      }
    }
  })

  if (!miniQuiz) {
    throw new Error('Mini kuis tidak ditemukan')
  }

  // Cek riwayat percobaan
  const attempts = await prisma.miniQuizAttempt.findMany({
    where: { userId, miniQuizId },
    orderBy: { attemptNumber: 'asc' }
  })

  // Kalau sudah lulus, tidak perlu coba lagi
  const sudahLulus = attempts.some(a => a.isPassed)
  if (sudahLulus) {
    throw new Error('Kamu sudah lulus mini kuis ini!')
  }

  // Cek apakah sudah habis percobaan
  if (attempts.length >= miniQuiz.maxAttempts) {
    throw new Error(
      `Kamu sudah mencapai batas maksimal ${miniQuiz.maxAttempts}x percobaan. Silakan baca ulang materi terlebih dahulu.`
    )
  }

  // Hitung skor
  let benar = 0
  const totalSoal = miniQuiz.questions.length

  jawaban.forEach(item => {
    const question = miniQuiz.questions.find(q => q.id === item.questionId)
    if (!question) return

    const pilihanBenar = question.options.find(
      opt => opt.id === item.optionId && opt.isCorrect
    )
    if (pilihanBenar) benar++
  })

  const skor = Math.round((benar / totalSoal) * 100)
  const isPassed = skor >= miniQuiz.passingScore
  const attemptNumber = attempts.length + 1

  // Simpan percobaan
  const attempt = await prisma.miniQuizAttempt.create({
    data: {
      userId,
      miniQuizId,
      attemptNumber,
      skor,
      isPassed
    }
  })

  // Hitung sisa percobaan
  const sisaPercobaan = miniQuiz.maxAttempts - attemptNumber

  return {
    attemptNumber,
    skor,
    isPassed,
    benar,
    totalSoal,
    passingScore: miniQuiz.passingScore,
    sisaPercobaan: isPassed ? 0 : sisaPercobaan,
    pesan: isPassed
      ? 'Selamat! Kamu lulus mini kuis ini. Lanjut ke materi berikutnya!'
      : sisaPercobaan > 0
        ? `Belum lulus. Sisa percobaan: ${sisaPercobaan}x`
        : 'Percobaan habis. Silakan baca ulang materi dari awal.'
  }
}

// ================================================
// CHECK CONTENT LOCK — Cek apakah konten terkunci
// ================================================
const checkContentLock = async (userId, contentId) => {
  // Ambil info konten ini
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      urutan: true,
      moduleId: true,
      miniQuiz: { select: { id: true } }
    }
  })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  // Konten pertama selalu terbuka
  if (content.urutan === 1) {
    return { isLocked: false, alasan: null }
  }

  // Cari konten sebelumnya
  const kontenSebelumnya = await prisma.content.findFirst({
    where: {
      moduleId: content.moduleId,
      urutan: content.urutan - 1
    },
    include: {
      miniQuiz: {
        include: {
          attempts: {
            where: { userId }
          }
        }
      }
    }
  })

  if (!kontenSebelumnya) {
    return { isLocked: false, alasan: null }
  }

  // Kalau konten sebelumnya tidak punya mini kuis → terbuka
  if (!kontenSebelumnya.miniQuiz) {
    return { isLocked: false, alasan: null }
  }

  // Cek apakah guru sudah lulus mini kuis konten sebelumnya
  const sudahLulus = kontenSebelumnya.miniQuiz.attempts.some(
    a => a.isPassed
  )

  if (!sudahLulus) {
    return {
      isLocked: true,
      alasan: `Kamu harus lulus mini kuis "${kontenSebelumnya.judul}" terlebih dahulu`,
      miniQuizId: kontenSebelumnya.miniQuiz.id
    }
  }

  return { isLocked: false, alasan: null }
}

module.exports = {
  getMiniQuizByContent,
  createMiniQuiz,
  createQuestion,
  getMyAttempts,
  submitAttempt,
  checkContentLock
}