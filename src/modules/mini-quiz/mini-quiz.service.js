const prisma = require('../../config/database')

// ================================================
// GET MINI QUIZ BY CONTENT — Ambil mini kuis
// ================================================
const getMiniQuizByContent = async (contentId) => {
  // Menggunakan findMany agar 1 materi bisa punya mini quiz di tengah video & di akhir materi
  const miniQuizzes = await prisma.miniQuiz.findMany({
    where: { contentId },
    select: {
      id: true,
      judul: true,
      timestampSeconds: true, // Untuk pemicu pop-up di detik video tertentu (misal: 120 = menit ke-2)
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
    },
    orderBy: { timestampSeconds: 'asc' }
  })

  return miniQuizzes
}

// ================================================
// CREATE MINI QUIZ — Admin buat mini kuis
// ================================================
const createMiniQuiz = async (contentId, data) => {
  const { judul, passingScore, maxAttempts, timestampSeconds } = data

  // Cek apakah konten ada
  const contentAda = await prisma.content.findUnique({
    where: { id: contentId }
  })

  if (!contentAda) {
    throw new Error('Konten tidak ditemukan')
  }

  const miniQuizBaru = await prisma.miniQuiz.create({
    data: {
      contentId,
      judul,
      timestampSeconds: timestampSeconds ? parseInt(timestampSeconds) : null, // null jika kuis di akhir materi
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

  const isLolos = attempts.some(a => a.isLolos)
  const jumlahPercobaan = attempts.length
  const sisaPercobaan = miniQuiz.maxAttempts - jumlahPercobaan

  return {
    isLolos,
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
  let attempts = await prisma.miniQuizAttempt.findMany({
    where: { userId, miniQuizId },
    orderBy: { attemptNumber: 'asc' }
  })

  // Kalau sudah lulus, tidak perlu coba lagi
  const sudahLulus = attempts.some(a => a.isLolos)
  if (sudahLulus) {
    throw new Error('Kamu sudah lulus mini kuis ini!')
  }

  // Hitung skor
  let benar = 0
  const totalSoal = miniQuiz.questions.length

  if (totalSoal === 0) {
    throw new Error('Mini kuis ini belum memiliki soal')
  }

  jawaban.forEach(item => {
    const question = miniQuiz.questions.find(q => q.id === item.questionId)
    if (!question) return

    const pilihanBenar = question.options.find(
      opt => opt.id === item.optionId && opt.isCorrect
    )
    if (pilihanBenar) benar++
  })

  const skor = Math.round((benar / totalSoal) * 100)
  const isLolos = skor >= miniQuiz.passingScore
  const attemptNumber = attempts.length + 1

  // Simpan percobaan baru
  await prisma.miniQuizAttempt.create({
    data: {
      userId,
      miniQuizId,
      attemptNumber,
      skor,
      isLolos: isLolos
    }
  })

  const maxAttempts = miniQuiz.maxAttempts
  const sisaPercobaan = maxAttempts - attemptNumber

  // PERBAIKAN: Jika gagal di percobaan ke-3 (habis), otomatis reset percobaan agar siap diulang dari awal
  let mustRepeat = false
  if (!isLolos && sisaPercobaan <= 0) {
    mustRepeat = true
    await prisma.miniQuizAttempt.deleteMany({
      where: { userId, miniQuizId }
    })
  }

  return {
    attemptNumber,
    skor,
    isLolos,
    benar,
    totalSoal,
    passingScore: miniQuiz.passingScore,
    sisaPercobaan: isLolos ? 0 : (sisaPercobaan < 0 ? 0 : sisaPercobaan),
    mustRepeat,
    pesan: isLolos
      ? 'Selamat! Kamu lulus mini kuis ini. Lanjut ke materi berikutnya!'
      : mustRepeat
        ? `Kamu telah gagal ${maxAttempts}x. Status kuis di-reset, kamu harus mempelajari ulang materi ini!`
        : `Belum lulus. Nilai kamu (${skor}) belum mencapai standar (${miniQuiz.passingScore}%). Sisa percobaan: ${sisaPercobaan}x`
  }
}

// ================================================
// CHECK CONTENT LOCK — Cek apakah konten terkunci
// ================================================
const checkContentLock = async (userId, contentId) => {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      urutan: true,
      moduleId: true,
      judul: true
    }
  })

  if (!content) {
    throw new Error('Konten tidak ditemukan')
  }

  // Konten pertama selalu terbuka
  if (content.urutan === 1) {
    return { isLocked: false, alasan: null }
  }

  // Cari konten tepat sebelum ini
  const kontenSebelumnya = await prisma.content.findFirst({
    where: {
      moduleId: content.moduleId,
      urutan: content.urutan - 1
    },
    include: {
      miniQuizzes: {
        include: {
          attempts: {
            where: { userId }
          }
        }
      }
    }
  })

  if (!kontenSebelumnya || !kontenSebelumnya.miniQuizzes || kontenSebelumnya.miniQuizzes.length === 0) {
    return { isLocked: false, alasan: null }
  }

  // Cek apakah guru sudah lulus semua mini kuis pada konten sebelumnya
  const semuaQuizLulus = kontenSebelumnya.miniQuizzes.every(quiz =>
    quiz.attempts.some(a => a.isLolos)
  )

  if (!semuaQuizLulus) {
    return {
      isLocked: true,
      alasan: `Kamu harus menyelesaikan dan lulus semua mini kuis pada materi "${kontenSebelumnya.judul}" terlebih dahulu`
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