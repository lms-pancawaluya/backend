// src/modules/contents/contents.service.js

const prisma = require('../../config/database')

// ================================================
// GET ALL CONTENTS BY MODULE
// ================================================
const getContentsByModule = async (moduleId) => {
  // Cek apakah modul ada dulu
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  const contents = await prisma.content.findMany({
    where: { moduleId },
    include: {
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
  })

  return contents
}

// ================================================
// CREATE CONTENT
// ================================================
const createContent = async (moduleId, data) => {
  const { judul, tipe, konten, urutan } = data

  // Cek apakah modul ada
  const moduleAda = await prisma.module.findUnique({
    where: { id: moduleId }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // Cek apakah urutan sudah dipakai di modul ini
  const urutanSudahAda = await prisma.content.findFirst({
    where: { moduleId, urutan }
  })

  if (urutanSudahAda) {
    throw new Error(`Urutan ${urutan} sudah dipakai konten lain di modul ini`)
  }

  const contentBaru = await prisma.content.create({
    data: {
      moduleId,
      judul,
      tipe,
      konten,
      urutan
    }
  })

  return contentBaru
}

// ================================================
// UPDATE CONTENT
// ================================================
const updateContent = async (id, data) => {
  const { judul, tipe, konten, urutan } = data

  // Cek apakah content ada
  const contentAda = await prisma.content.findUnique({
    where: { id }
  })

  if (!contentAda) {
    throw new Error('Konten tidak ditemukan')
  }

  // Kalau urutan diubah, cek apakah urutan baru sudah dipakai
  if (urutan && urutan !== contentAda.urutan) {
    const urutanSudahAda = await prisma.content.findFirst({
      where: {
        moduleId: contentAda.moduleId,
        urutan,
        NOT: { id }
      }
    })

    if (urutanSudahAda) {
      throw new Error(`Urutan ${urutan} sudah dipakai konten lain`)
    }
  }

  const contentUpdated = await prisma.content.update({
    where: { id },
    data: {
      ...(judul && { judul }),
      ...(tipe && { tipe }),
      ...(konten && { konten }),
      ...(urutan && { urutan })
    }
  })

  return contentUpdated
}

// ================================================
// DELETE CONTENT
// ================================================
const deleteContent = async (id) => {
  const contentAda = await prisma.content.findUnique({
    where: { id }
  })

  if (!contentAda) {
    throw new Error('Konten tidak ditemukan')
  }

  await prisma.content.delete({
    where: { id }
  })

  return { pesan: 'Konten berhasil dihapus' }
}

module.exports = {
  getContentsByModule,
  createContent,
  updateContent,
  deleteContent
}