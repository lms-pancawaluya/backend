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
      status: true,
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
    status: user.status,
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
      status: true,
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
  // Tambahkan 'role' di destructuring
  const { nama, email, role, gelar, sekolah, noHp, fotoProfil, status } = data
  // ⚠️ NIP sengaja tidak ada — tidak boleh diubah!

  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  // Objek penampung update
  const payloadToUpdate = {}

  if (nama) payloadToUpdate.nama = nama
  
  // Tambahkan handling role
  if (role) {
    const roleValid = ['admin', 'guru']
    if (!roleValid.includes(role)) {
      throw new Error(`Role harus salah satu dari: ${roleValid.join(', ')}`)
    }
    payloadToUpdate.role = role
  }

  if (email && email !== userAda.email) {
    const emailSudahAda = await prisma.user.findUnique({
      where: { email }
    })
    if (emailSudahAda) {
      throw new Error('Email sudah digunakan user lain')
    }
    payloadToUpdate.email = email
  }

  if (gelar !== undefined) payloadToUpdate.gelar = gelar
  if (sekolah !== undefined) payloadToUpdate.sekolah = sekolah
  if (noHp !== undefined) payloadToUpdate.noHp = noHp
  if (fotoProfil !== undefined) payloadToUpdate.fotoProfil = fotoProfil

  // Penanganan status (Aman)
  if (status !== undefined && status !== null && status !== '') {
    const statusNormalized = String(status).toLowerCase()
    const statusValid = ['aktif', 'nonaktif', 'pensiun', 'wafat']
    
    if (!statusValid.includes(statusNormalized)) {
      throw new Error(`Status harus salah satu dari: ${statusValid.join(', ')}`)
    }
    
    payloadToUpdate.status = statusNormalized
  }

  const userUpdated = await prisma.user.update({
    where: { id },
    data: payloadToUpdate,
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
      status: true,
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

// ================================================
// ADMIN RESET PASSWORD — Admin reset password guru
// ================================================
const adminResetPassword = async (id, passwordBaru) => {
  const user = await prisma.user.findUnique({
    where: { id }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  // Pastikan yang direset adalah guru, bukan admin lain
  if (user.role === 'admin') {
    throw new Error('Tidak bisa reset password akun admin')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  })

  return { pesan: `Password guru ${user.nama} berhasil direset oleh admin.` }
}

module.exports = { 
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updatePassword,
  adminResetPassword 
}