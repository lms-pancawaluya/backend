// src/modules/modules/modules.service.js

const prisma = require('../../config/database')
const notificationService = require('../notifications/notifications.service')
const progressService = require('../progress/progress.service')

// Helper untuk membuat error dengan status code HTTP
const createError = (message, statusCode) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

// Helper otorisasi akses Course induk & validasi tanggal
const validateCourseAccess = async (courseId, user, tanggalMulai = null, tanggalSelesai = null) => {
  if (!courseId) return null

  const course = await prisma.course.findUnique({
    where: { id: courseId }
  })

  if (!course) {
    throw createError('Course tidak ditemukan', 404)
  }

  // Admin bebas mengelola semua modul
  if (user.role !== 'admin') {
    const isOwner = course.createdBy === user.id
    const isSameSchool = course.schoolId && course.schoolId === user.schoolId

    if (!isOwner && !isSameSchool) {
      throw createError('Kamu tidak memiliki akses untuk mengelola modul pada Course ini', 403)
    }
  }

  // Validasi: Tanggal modul harus berada di dalam periode Course (jika course punya tanggal)
  if (tanggalMulai && course.tanggalMulai && new Date(tanggalMulai) < new Date(course.tanggalMulai)) {
    throw createError('Tanggal mulai modul tidak boleh lebih awal dari tanggal mulai Course', 400)
  }

  if (tanggalSelesai && course.tanggalSelesai && new Date(tanggalSelesai) > new Date(course.tanggalSelesai)) {
    throw createError('Tanggal selesai modul tidak boleh melebihi tanggal selesai Course', 400)
  }

  return course
}

// ================================================
// GET ALL MODULES
// ================================================
const getAllModules = async (query = {}, currentUser = null) => {
  const { courseId } = query
  const where = {}

  if (courseId) {
    where.courseId = courseId
  }

  const modules = await prisma.module.findMany({
    where,
    select: {
      id: true,
      courseId: true,
      judul: true,
      deskripsi: true,
      aspekPancawaluya: true,
      urutan: true,
      tanggalMulai: true,
      tanggalSelesai: true,
      createdAt: true,
      course: {
        select: {
          id: true,
          judul: true,
          schoolId: true,
          tanggalMulai: true,
          tanggalSelesai: true
        }
      },
      _count: {
        select: {
          contents: true,
          preTests: true,
          postTests: true
        }
      }
    },
    orderBy: { urutan: 'asc' }
  })

  return modules.map((module) => ({
    ...module,
    _count: {
      ...module._count,
      evaluations: (module._count.preTests || 0) + (module._count.postTests || 0)
    }
  }))
}

// ================================================
// GET MODULE BY ID
// ================================================
const getModuleById = async (id, currentUser = null) => {
  const module = await prisma.module.findUnique({
    where: { id },
    include: {
      course: {
        select: {
          id: true,
          schoolId: true,
          tanggalMulai: true,
          tanggalSelesai: true
        }
      },
      contents: {
        select: {
          id: true,
          judul: true,
          tipe: true,
          konten: true,
          urutan: true,
          miniQuizzes: {
            select: {
              id: true,
              judul: true,
              timestampSeconds: true,
              passingScore: true,
              maxAttempts: true
            },
            orderBy: {
              timestampSeconds: 'asc'
            }
          }
        },
        orderBy: { urutan: 'asc' }
      },
      preTests: {
        select: {
          id: true,
          judul: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      },
      postTests: {
        select: {
          id: true,
          judul: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!module) {
    throw createError('Modul tidak ditemukan', 404)
  }

  if (module.course && module.course.schoolId && currentUser && currentUser.role !== 'admin') {
    if (module.course.schoolId !== currentUser.schoolId) {
      throw createError('Kamu tidak memiliki akses ke modul sekolah ini', 403)
    }
  }

  const evaluations = [
    ...module.preTests.map((preTest) => ({
      ...preTest,
      tipe: 'pre_test'
    })),
    ...module.postTests.map((postTest) => ({
      ...postTest,
      tipe: 'post_test'
    }))
  ]

  const stageMap = currentUser?.id
    ? await progressService.hitungStageCompletion(currentUser.id, [id])
    : {}

  const stage = stageMap[id] || {
    preTestCompleted: false,
    materialCompleted: false,
    postTestCompleted: false
  }

  return {
    ...module,
    evaluations,
    preTestCompleted: stage.preTestCompleted,
    materialCompleted: stage.materialCompleted,
    postTestCompleted: stage.postTestCompleted
  }
}

// ================================================
// CREATE MODULE
// ================================================
const createModule = async (data, currentUser) => {
  const { courseId, judul, deskripsi, aspekPancawaluya, urutan, tanggalMulai, tanggalSelesai } = data

  if (!courseId) {
    throw createError('courseId wajib disertakan', 400)
  }

  const parentCourse = await validateCourseAccess(courseId, currentUser, tanggalMulai, tanggalSelesai)

  const urutanSudahAda = await prisma.module.findFirst({
    where: { courseId, urutan }
  })

  if (urutanSudahAda) {
    throw createError(`Urutan ${urutan} sudah dipakai modul lain dalam course ini`, 400)
  }

  const moduleBaru = await prisma.module.create({
    data: {
      courseId,
      judul,
      deskripsi,
      aspekPancawaluya: aspekPancawaluya || 'umum',
      urutan,
      tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : null,
      tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null
    }
  })

  try {
    const teacherWhere = { role: 'guru' }
    
    if (parentCourse && parentCourse.schoolId) {
      teacherWhere.schoolId = parentCourse.schoolId
    }

    const teachers = await prisma.user.findMany({
      where: teacherWhere,
      select: { id: true }
    })

    if (teachers.length > 0) {
      const notificationsData = teachers.map((teacher) => ({
        userId: teacher.id,
        title: 'Modul Baru',
        message: `Modul baru "${moduleBaru.judul}" telah tersedia${parentCourse ? ` di ${parentCourse.judul}` : ''}. Yuk pelajari sekarang!`,
        type: 'NEW_MODULE',
        linkUrl: `/modules/${moduleBaru.id}`
      }))

      await notificationService.createManyNotifications(notificationsData)
    }
  } catch (error) {
    console.error('Gagal mengirimkan notifikasi modul baru:', error.message)
  }

  return moduleBaru
}

// ================================================
// UPDATE MODULE
// ================================================
const updateModule = async (id, data, currentUser) => {
  const { courseId, judul, deskripsi, aspekPancawaluya, urutan, tanggalMulai, tanggalSelesai } = data

  const moduleAda = await prisma.module.findUnique({
    where: { id }
  })

  if (!moduleAda) {
    throw createError('Modul tidak ditemukan', 404)
  }

  const targetCourseId = courseId !== undefined ? courseId : moduleAda.courseId

  if (targetCourseId) {
    await validateCourseAccess(targetCourseId, currentUser, tanggalMulai, tanggalSelesai)
  }

  if (urutan && (urutan !== moduleAda.urutan || targetCourseId !== moduleAda.courseId)) {
    if (targetCourseId) {
      const urutanSudahAda = await prisma.module.findFirst({
        where: {
          courseId: targetCourseId,
          urutan,
          NOT: { id }
        }
      })

      if (urutanSudahAda) {
        throw createError(`Urutan ${urutan} sudah dipakai modul lain dalam course ini`, 400)
      }
    }
  }

  const moduleUpdated = await prisma.module.update({
    where: { id },
    data: {
      ...(courseId !== undefined && { courseId }),
      ...(judul && { judul }),
      ...(deskripsi && { deskripsi }),
      ...(aspekPancawaluya && { aspekPancawaluya }),
      ...(urutan && { urutan }),
      ...(tanggalMulai !== undefined && { tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : null }),
      ...(tanggalSelesai !== undefined && { tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null })
    }
  })

  return moduleUpdated
}

// ================================================
// DELETE MODULE
// ================================================
const deleteModule = async (id, currentUser) => {
  const moduleAda = await prisma.module.findUnique({
    where: { id }
  })

  if (!moduleAda) {
    throw createError('Modul tidak ditemukan', 404)
  }

  if (moduleAda.courseId) {
    await validateCourseAccess(moduleAda.courseId, currentUser)
  }

  await prisma.module.delete({
    where: { id }
  })

  return { pesan: 'Modul berhasil dihapus' }
}

module.exports = {
  getAllModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule
}