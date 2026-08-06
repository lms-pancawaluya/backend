// src/modules/users/users.service.js

const prisma = require('../../config/database')

// ================================================
// GET ALL USERS — Ambil semua guru
// ================================================
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      createdAt: true,
      // Hitung berapa modul yang sudah selesai
      progress: {
        where: { status: 'selesai' },
        select: { id: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Tambahkan field modulSelesai untuk kemudahan frontend
  return users.map(user => ({
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    modulSelesai: user.progress.length
  }))
}

// ================================================
// GET USER BY ID — Ambil detail satu user
// ================================================
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      createdAt: true,
      // Ambil juga progress belajarnya
      progress: {
        select: {
          status: true,
          completedAt: true,
          module: {
            select: {
              judul: true,
              aspekPancawaluya: true
            }
          }
        }
      }
    }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  return user
}

// ================================================
// UPDATE USER — Update data guru
// ================================================
const updateUser = async (id, data) => {
  const { nama, email, role } = data

  // Cek apakah user ada
  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  // Kalau email diubah, cek apakah email baru sudah dipakai user lain
  if (email && email !== userAda.email) {
    const emailSudahAda = await prisma.user.findUnique({
      where: { email }
    })

    if (emailSudahAda) {
      throw new Error('Email sudah digunakan user lain')
    }
  }

  // Update user
  const userUpdated = await prisma.user.update({
    where: { id },
    data: {
      ...(nama && { nama }),
      ...(email && { email }),
      ...(role && { role })
    },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      createdAt: true
    }
  })

  return userUpdated
}

// ================================================
// DELETE USER — Hapus akun guru
// ================================================
const deleteUser = async (id) => {
  // Cek apakah user ada
  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  // Hapus user
  // Progress & answers otomatis terhapus karena onDelete: Cascade
  await prisma.user.delete({
    where: { id }
  })

  return { pesan: 'User berhasil dihapus' }
}

module.exports = { getAllUsers, getUserById, updateUser, deleteUser }