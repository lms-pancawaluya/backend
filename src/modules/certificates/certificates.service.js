// src/modules/certificates/certificates.service.js

const prisma = require('../../config/database')
const progressService = require('../progress/progress.service')

// ================================================
// HELPER — Error dengan status code HTTP
// ================================================
const createError = (message, statusCode) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// ================================================
// HELPER — Generate nomor sertifikat unik
//
// Format: PANC-<TAHUN>-<8 karakter acak uppercase>
// Contoh: PANC-2026-4F9A2C1D
//
// - Tidak bergantung pada nama user.
// - Mengandalkan crypto.randomBytes untuk mencegah duplikasi.
// - Unique constraint di DB tetap menjadi safety net.
// ================================================
const crypto = require('crypto')

const generateNomorSertifikat = () => {
  const tahun = new Date().getFullYear()

  // 8 karakter heksadesimal (uppercase) = 4 byte acak
  const acak = crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()

  return `PANC-${tahun}-${acak}`
}

// ================================================
// HELPER — Baca snapshot nama dari profile/user
//
// Source of truth nama profile saat ini adalah
// User.nama (dipakai authMiddleware, users.service, dll).
// Tidak ada field nama profile lain di schema.
// ================================================
const ambilNamaUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nama: true }
  })

  if (!user) {
    throw createError('User tidak ditemukan', 404)
  }

  return user.nama
}

// ================================================
// HELPER — Hitung completion setiap module pada
// sebuah course memakai logic progress existing.
//
// Memakai progressService.hitungStageCompletion
// agar TIDAK membuat definisi completion baru.
//
// Sebuah module dianggap selesai bila seluruh stage
// yang tersedia selesai:
//   preTestCompleted && materialCompleted && postTestCompleted
// ================================================
const hitungCourseCompletion = async (userId, courseId) => {
  const modules = await prisma.module.findMany({
    where: { courseId },
    select: { id: true }
  })

  const totalModules = modules.length

  // Course tanpa module: TIDAK otomatis eligible.
  // Tanpa module, tidak ada pekerjaan yang dapat diselesaikan,
  // sehingga course dianggap belum 100%.
  if (totalModules === 0) {
    return {
      totalModules: 0,
      completedModules: 0,
      courseProgress: 0,
      isCompleted: false
    }
  }

  const moduleIds = modules.map((m) => m.id)

  const stageMap = await progressService.hitungStageCompletion(
    userId,
    moduleIds
  )

  let completedModules = 0
  const moduleDetail = []

  moduleIds.forEach((moduleId) => {
    const stage = stageMap[moduleId] || {
      preTestCompleted: false,
      materialCompleted: false,
      postTestCompleted: false
    }

    const isCompleted =
      stage.preTestCompleted === true &&
      stage.materialCompleted === true &&
      stage.postTestCompleted === true

    if (isCompleted) {
      completedModules++
    }

    moduleDetail.push({
      moduleId,
      preTestCompleted: stage.preTestCompleted === true,
      materialCompleted: stage.materialCompleted === true,
      postTestCompleted: stage.postTestCompleted === true,
      isCompleted
    })
  })

  const courseProgress = Math.round(
    (completedModules / totalModules) * 100
  )

  return {
    totalModules,
    completedModules,
    courseProgress,
    isCompleted: completedModules === totalModules,
    moduleDetail
  }
}

// ================================================
// HELPER — Validasi akses user terhadap course
//
// Mengikuti aturan school-scope yang SUDAH ADA di
// courses.service.getCourseById:
// - Course global (schoolId null) -> boleh.
// - Course sekolah -> admin bebas; non-admin hanya
//   bila schoolId sama.
// ================================================
const pastikanAksesCourse = (course, user) => {
  if (course.schoolId) {
    if (user.role !== 'admin' && course.schoolId !== user.schoolId) {
      throw createError(
        'Kamu tidak memiliki akses ke Course sekolah ini',
        403
      )
    }
  }
}

// ================================================
// GET MY CERTIFICATES — Semua sertifikat milik user
// ================================================
const getMyCertificates = async (userId) => {
  const certificates = await prisma.certificate.findMany({
    where: { userId },
    include: {
      course: {
        select: { id: true, judul: true }
      }
    },
    orderBy: { issuedAt: 'desc' }
  })

  return certificates.map((cert) => ({
    id: cert.id,
    courseId: cert.courseId,
    courseName: cert.course?.judul || null,
    recipientName: cert.recipientName,
    certificateNumber: cert.nomorSertifikat,
    fileUrl: cert.fileUrl,
    templateId: cert.templateId,
    status: cert.status,
    issuedAt: cert.issuedAt
  }))
}

// ================================================
// GET CERTIFICATE BY ID — Detail satu sertifikat
//
// Hanya pemilik sertifikat (atau admin) yang boleh.
// ================================================
const getCertificateById = async (certificateId, user) => {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      course: {
        select: { id: true, judul: true }
      }
    }
  })

  if (!cert) {
    throw createError('Sertifikat tidak ditemukan', 404)
  }

  if (cert.userId !== user.id && user.role !== 'admin') {
    throw createError(
      'Kamu tidak memiliki akses ke sertifikat ini',
      403
    )
  }

  return {
    id: cert.id,
    courseId: cert.courseId,
    courseName: cert.course?.judul || null,
    recipientName: cert.recipientName,
    certificateNumber: cert.nomorSertifikat,
    fileUrl: cert.fileUrl,
    templateId: cert.templateId,
    status: cert.status,
    issuedAt: cert.issuedAt
  }
}

// ================================================
// CLAIM CERTIFICATE — Klaim sertifikat course
//
// Idempotent:
// - Course < 100% -> ditolak, TIDAK membuat sertifikat.
// - Course 100% & belum ada -> buat baru.
// - Sudah ada -> kembalikan yang existing (tanpa
//   membuat duplikat / nomor baru / mengubah issuedAt).
// ================================================
const claimCertificate = async (userId, courseId) => {
  // ================================================
  // 1. Pastikan course exists
  // ================================================
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      judul: true,
      schoolId: true,
      hasCertificate: true
    }
  })

  if (!course) {
    throw createError('Course tidak ditemukan', 404)
  }

  // ================================================
  // 2. Authorization (school-scope, pola existing)
  // ================================================
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, schoolId: true }
  })

  if (!user) {
    throw createError('User tidak ditemukan', 404)
  }

  pastikanAksesCourse(course, user)

  // ================================================
  // 3. Course harus mengaktifkan sertifikat
  // ================================================
  if (!course.hasCertificate) {
    throw createError(
      'Course ini tidak menyediakan sertifikat',
      400
    )
  }

  // ================================================
  // 4. Certificate sudah ada? -> idempotent return
  //    (dicek lebih dulu agar claim berulang tidak
  //    menghitung ulang dan tetap idempotent)
  // ================================================
  const existing = await prisma.certificate.findUnique({
    where: {
      userId_courseId: { userId, courseId }
    },
    include: {
      course: { select: { id: true, judul: true } }
    }
  })

  if (existing) {
    return {
      status: 'already_claimed',
      certificate: {
        id: existing.id,
        courseId: existing.courseId,
        courseName: existing.course?.judul || null,
        recipientName: existing.recipientName,
        certificateNumber: existing.nomorSertifikat,
        fileUrl: existing.fileUrl,
        templateId: existing.templateId,
        status: existing.status,
        issuedAt: existing.issuedAt
      }
    }
  }

  // ================================================
  // 5. Hitung completion course (pakai logic existing)
  // ================================================
  const completion = await hitungCourseCompletion(userId, courseId)

  if (!completion.isCompleted) {
    throw createError(
      `Course belum 100% selesai. Progress saat ini ${completion.courseProgress}%`,
      400
    )
  }

  // ================================================
  // 6. Ambil snapshot nama dari profile user
  // ================================================
  const recipientName = await ambilNamaUser(userId)

  // ================================================
  // 7. Buat sertifikat (unique constraint sebagai
  //    safety net anti-duplikat saat race condition)
  // ================================================
  try {
    const cert = await prisma.certificate.create({
      data: {
        userId,
        courseId,
        recipientName,
        nomorSertifikat: generateNomorSertifikat(),
        status: 'issued',
        // fileUrl & templateId null sampai template
        // Canva / PDF generation tersedia.
        fileUrl: null,
        templateId: null
      },
      include: {
        course: { select: { id: true, judul: true } }
      }
    })

    return {
      status: 'created',
      certificate: {
        id: cert.id,
        courseId: cert.courseId,
        courseName: cert.course?.judul || null,
        recipientName: cert.recipientName,
        certificateNumber: cert.nomorSertifikat,
        fileUrl: cert.fileUrl,
        templateId: cert.templateId,
        status: cert.status,
        issuedAt: cert.issuedAt
      }
    }
  } catch (error) {
    // Race condition: dua request claim bersamaan.
    // Unique constraint (userId, courseId) mencegah duplikat.
    if (error.code === 'P2002') {
      const raceCert = await prisma.certificate.findUnique({
        where: {
          userId_courseId: { userId, courseId }
        },
        include: {
          course: { select: { id: true, judul: true } }
        }
      })

      if (raceCert) {
        return {
          status: 'already_claimed',
          certificate: {
            id: raceCert.id,
            courseId: raceCert.courseId,
            courseName: raceCert.course?.judul || null,
            recipientName: raceCert.recipientName,
            certificateNumber: raceCert.nomorSertifikat,
            fileUrl: raceCert.fileUrl,
            templateId: raceCert.templateId,
            status: raceCert.status,
            issuedAt: raceCert.issuedAt
          }
        }
      }
    }

    throw error
  }
}

// ================================================
// EXPORT
// ================================================
module.exports = {
  getMyCertificates,
  getCertificateById,
  claimCertificate,
  // diekspor untuk kebutuhan pengujian/logika bersama
  hitungCourseCompletion,
  generateNomorSertifikat
}
