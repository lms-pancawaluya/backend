// src/modules/certificates/certificates.service.js

const prisma = require('../../config/database')
const progressService = require('../progress/progress.service')
const uploadService = require('../upload/upload.service')
const pdfService = require('./certificate-pdf.service')
const crypto = require('crypto')

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
// ================================================
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
// HELPER — Hitung completion setiap module pada course
// ================================================
const hitungCourseCompletion = async (userId, courseId) => {
  const modules = await prisma.module.findMany({
    where: { courseId },
    select: { id: true }
  })

  const totalModules = modules.length

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
// ================================================
const claimCertificate = async (userId, courseId) => {
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, schoolId: true }
  })

  if (!user) {
    throw createError('User tidak ditemukan', 404)
  }

  pastikanAksesCourse(course, user)

  if (!course.hasCertificate) {
    throw createError(
      'Course ini tidak menyediakan sertifikat',
      400
    )
  }

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

  const completion = await hitungCourseCompletion(userId, courseId)

  if (!completion.isCompleted) {
    throw createError(
      `Course belum 100% selesai. Progress saat ini ${completion.courseProgress}%`,
      400
    )
  }

  const recipientName = await ambilNamaUser(userId)

  try {
    const cert = await prisma.certificate.create({
      data: {
        userId,
        courseId,
        recipientName,
        nomorSertifikat: generateNomorSertifikat(),
        status: 'issued',
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
// UPLOAD TEMPLATE CERTIFICATE COURSE (Admin)
// ================================================
const uploadCertificateTemplate = async (courseId, file, user) => {
  if (!file) {
    throw createError('File template PDF wajib diunggah', 400)
  }

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

  pastikanAksesCourse(course, user)

  if (!course.hasCertificate) {
    throw createError('Course ini tidak menyediakan sertifikat', 400)
  }

  const { url, publicId } = await uploadService.uploadCertificateTemplate(
    file,
    courseId
  )

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: {
      certificateTemplateUrl: url,
      certificateTemplateId: publicId
    },
    select: {
      id: true,
      judul: true,
      certificateTemplateUrl: true,
      certificateTemplateId: true
    }
  })

  return updated
}

// ================================================
// GET TEMPLATE CERTIFICATE COURSE
// ================================================
const getCertificateTemplate = async (courseId, user) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      judul: true,
      schoolId: true,
      certificateTemplateUrl: true,
      certificateTemplateId: true,
      certificateOverlay: true
    }
  })

  if (!course) {
    throw createError('Course tidak ditemukan', 404)
  }

  if (user) {
    pastikanAksesCourse(course, user)
  }

  return {
    courseId: course.id,
    courseName: course.judul,
    hasTemplate: Boolean(course.certificateTemplateUrl),
    templateUrl: course.certificateTemplateUrl,
    templateId: course.certificateTemplateId,
    overlay: course.certificateOverlay || null
  }
}

// ================================================
// GENERATE CERTIFICATE (PDF personal)
// ================================================
const generateCertificate = async (
  certificateId,
  user,
  { force = false } = {}
) => {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      course: {
        select: {
          id: true,
          judul: true,
          certificateTemplateUrl: true,
          certificateTemplateId: true,
          certificateOverlay: true
        }
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

  if (cert.fileUrl && !force) {
    return {
      status: 'already_generated',
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
  }

  const templateUrl = cert.course?.certificateTemplateUrl

  if (!templateUrl) {
    throw createError(
      'Course belum memiliki template sertifikat',
      400
    )
  }

  const templatePdfBuffer =
    await uploadService.downloadFileBuffer(templateUrl)

  const pdfBuffer = await pdfService.generateCertificatePdf({
    templatePdfBuffer,
    overlayConfig: cert.course?.certificateOverlay || null,
    data: {
      recipientName: cert.recipientName,
      certificateNumber: cert.nomorSertifikat,
      issuedAt: cert.issuedAt,
      courseName: cert.course?.judul || null
    }
  })

  const fileUrl = await uploadService.uploadCertificateFile(
    pdfBuffer,
    cert.nomorSertifikat
  )

  const updated = await prisma.certificate.update({
    where: { id: cert.id },
    data: {
      fileUrl,
      templateId: cert.course.certificateTemplateId,
      status: 'generated'
    },
    include: {
      course: { select: { id: true, judul: true } }
    }
  })

  return {
    status: 'generated',
    certificate: {
      id: updated.id,
      courseId: updated.courseId,
      courseName: updated.course?.judul || null,
      recipientName: updated.recipientName,
      certificateNumber: updated.nomorSertifikat,
      fileUrl: updated.fileUrl,
      templateId: updated.templateId,
      status: updated.status,
      issuedAt: updated.issuedAt
    }
  }
}

module.exports = {
  getMyCertificates,
  getCertificateById,
  claimCertificate,
  uploadCertificateTemplate,
  getCertificateTemplate,
  generateCertificate,
  hitungCourseCompletion,
  generateNomorSertifikat
}