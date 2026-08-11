// src/modules/users/users.service.js
const bcrypt = require('bcryptjs')
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
      gelar: true,   
      nip: true,        
      sekolah: true,    
      noHp: true,       
      fotoProfil: true, 
      createdAt: true,
      progress: {
        where: { status: 'selesai' },
        select: { id: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return users.map(user => ({
    id: user.id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    gelar: user.gelar, 
    nip: user.nip,
    sekolah: user.sekolah,
    noHp: user.noHp,
    fotoProfil: user.fotoProfil,
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
      gelar: true,
      nip: true,
      sekolah: true,
      noHp: true,
      fotoProfil: true,
      createdAt: true,
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
  const { nama, email, role, gelar, nip, sekolah, noHp, fotoProfil } = data

  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  if (email && email !== userAda.email) {
    const emailSudahAda = await prisma.user.findUnique({
      where: { email }
    })
    if (emailSudahAda) {
      throw new Error('Email sudah digunakan user lain')
    }
  }

  const userUpdated = await prisma.user.update({
    where: { id },
    data: {
      ...(nama && { nama }),
      ...(email && { email }),
      ...(role && { role }),
       ...(gelar !== undefined && { gelar }), 
      ...(gelar !== undefined && { gelar }),
      ...(nip !== undefined && { nip }),           
      ...(sekolah !== undefined && { sekolah }),   
      ...(noHp !== undefined && { noHp }),         
      ...(fotoProfil !== undefined && { fotoProfil }) 
    },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      gelar: true, 
      nip: true,
      sekolah: true,
      noHp: true,
      fotoProfil: true,
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

// ================================================
// UPDATE PASSWORD
// ================================================
const updatePassword = async (id, passwordLama, passwordBaru) => {
  // Ambil user dengan password
  const user = await prisma.user.findUnique({
    where: { id }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  // Verifikasi password lama
  const passwordCocok = await bcrypt.compare(passwordLama, user.password)
  if (!passwordCocok) {
    throw new Error('Password lama tidak sesuai')
  }

  // Hash password baru
  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  // Update password
  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  })
}

module.exports = { 
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updatePassword
}