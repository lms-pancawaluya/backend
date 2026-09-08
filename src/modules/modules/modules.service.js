// src/modules/modules/modules.service.js

const prisma = require('../../config/database')
const notificationService = require('../notifications/notifications.service')

const getAllModules = async (query = {}) => {
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
      createdAt: true,
      _count: {
        select: {
          contents: true,
          evaluations: true
        }
      }
    },
    orderBy: { urutan: 'asc' }
  })

  return modules
}

const getModuleById = async (id) => {
  const module = await prisma.module.findUnique({
    where: { id },
    select: {
      id: true,
      courseId: true,
      judul: true,
      deskripsi: true,
      aspekPancawaluya: true,
      urutan: true,
      createdAt: true,
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
      evaluations: {
        select: {
          id: true,
          judul: true,
          tipe: true,
          createdAt: true
        }
      }
    }
  })

  if (!module) {
    throw new Error('Modul tidak ditemukan')
  }

  return module
}

const createModule = async (data) => {
  const { courseId, judul, deskripsi, aspekPancawaluya, urutan } = data

  // Pengecekan urutan unik terbatas per Course
  if (courseId) {
    const urutanSudahAda = await prisma.module.findFirst({
      where: { courseId, urutan }
    })

    if (urutanSudahAda) {
      throw new Error(`Urutan ${urutan} sudah dipakai modul lain dalam course ini`)
    }
  }

  const moduleBaru = await prisma.module.create({
    data: {
      courseId: courseId || null,
      judul,
      deskripsi,
      aspekPancawaluya: aspekPancawaluya || 'umum',
      urutan
    }
  })

  // Broadcast Notifikasi ke Guru
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'guru' },
      select: { id: true }
    })

    if (teachers.length > 0) {
      const notificationsData = teachers.map((teacher) => ({
        userId: teacher.id,
        title: 'Modul Baru',
        message: `Modul baru "${moduleBaru.judul}" telah tersedia. Yuk pelajari sekarang!`,
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

const updateModule = async (id, data) => {
  const { courseId, judul, deskripsi, aspekPancawaluya, urutan } = data

  const moduleAda = await prisma.module.findUnique({
    where: { id }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const targetCourseId = courseId !== undefined ? courseId : moduleAda.courseId

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
        throw new Error(`Urutan ${urutan} sudah dipakai modul lain dalam course ini`)
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
      ...(urutan && { urutan })
    }
  })

  return moduleUpdated
}

const deleteModule = async (id) => {
  const moduleAda = await prisma.module.findUnique({
    where: { id }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
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