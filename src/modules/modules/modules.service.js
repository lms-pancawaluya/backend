// src/modules/modules/modules.service.js

const prisma = require('../../config/database')

// ================================================
// GET ALL MODULES — Ambil semua modul
// ================================================
const getAllModules = async () => {
  const modules = await prisma.module.findMany({
    select: {
      id: true,
      judul: true,
      deskripsi: true,
      aspekPancawaluya: true,
      urutan: true,
      createdAt: true,
      // Hitung jumlah konten & evaluasi
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

// ================================================
// GET MODULE BY ID — Ambil detail modul + konten
// ================================================
const getModuleById = async (id) => {
  const module = await prisma.module.findUnique({
    where: { id },
    select: {
      id: true,
      judul: true,
      deskripsi: true,
      aspekPancawaluya: true,
      urutan: true,
      createdAt: true,
      // Ambil semua konten di modul ini
      contents: {
        select: {
          id: true,
          judul: true,
          tipe: true,
          konten: true,
          urutan: true
        },
        orderBy: { urutan: 'asc' }
      },
      // Ambil semua evaluasi di modul ini
      evaluations: {
        select: {
          id: true,
          judul: true,
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

// ================================================
// CREATE MODULE — Buat modul baru
// ================================================
const createModule = async (data) => {
  const { judul, deskripsi, aspekPancawaluya, urutan } = data

  // Cek apakah urutan sudah dipakai
  const urutanSudahAda = await prisma.module.findFirst({
    where: { urutan }
  })

  if (urutanSudahAda) {
    throw new Error(`Urutan ${urutan} sudah dipakai modul lain`)
  }

  const moduleBaru = await prisma.module.create({
    data: {
      judul,
      deskripsi,
      aspekPancawaluya,
      urutan
    }
  })

  return moduleBaru
}

// ================================================
// UPDATE MODULE — Update modul
// ================================================
const updateModule = async (id, data) => {
  const { judul, deskripsi, aspekPancawaluya, urutan } = data

  // Cek apakah modul ada
  const moduleAda = await prisma.module.findUnique({
    where: { id }
  })

  if (!moduleAda) {
    throw new Error('Modul tidak ditemukan')
  }

  // Kalau urutan diubah, cek apakah urutan baru sudah dipakai
  if (urutan && urutan !== moduleAda.urutan) {
    const urutanSudahAda = await prisma.module.findFirst({
      where: {
        urutan,
        NOT: { id } // kecualikan modul yang sedang diupdate
      }
    })

    if (urutanSudahAda) {
      throw new Error(`Urutan ${urutan} sudah dipakai modul lain`)
    }
  }

  const moduleUpdated = await prisma.module.update({
    where: { id },
    data: {
      ...(judul && { judul }),
      ...(deskripsi && { deskripsi }),
      ...(aspekPancawaluya && { aspekPancawaluya }),
      ...(urutan && { urutan })
    }
  })

  return moduleUpdated
}

// ================================================
// DELETE MODULE — Hapus modul
// ================================================
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