const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')

// ================================================
// GET ALL USERS — Ambil semua user dengan Filter (Poin 2)
// ================================================
const getAllUsers = async (filters = {}) => {
  const { sekolah, kota, daerah, status, search, role } = filters

  const whereClause = {}

  // Filter Role (default ambil semua, atau bisa difilter spesifik)
  if (role) {
    whereClause.role = role
  }

  // Filter Sekolah
  if (sekolah) {
    whereClause.sekolah = { contains: sekolah, mode: 'insensitive' }
  }

  // Filter Kota
  if (kota) {
    whereClause.kota = { contains: kota, mode: 'insensitive' }
  }

  // Filter Daerah / Kecamatan
  if (daerah) {
    whereClause.daerah = { contains: daerah, mode: 'insensitive' }
  }

  // Filter Status
  if (status) {
    whereClause.status = status
  }

  // Search Nama, NIP, atau Email
  if (search) {
    whereClause.OR = [
      { nama: { contains: search, mode: 'insensitive' } },
      { nip: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ]
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      gelar: true,
      nip: true,
      sekolah: true,
      kota: true,
      daerah: true,
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
    kota: user.kota,
    daerah: user.daerah,
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
      kota: true,
      daerah: true,
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
// UPDATE USER — Update data user (Termasuk Role Pengajar)
// ================================================
const updateUser = async (id, data) => {
  const { nama, email, role, gelar, sekolah, kota, daerah, noHp, fotoProfil, status } = data

  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  const payloadToUpdate = {}

  if (nama) payloadToUpdate.nama = nama

  // Fix: Tambahkan 'pengajar' di roleValid
  if (role) {
    const roleValid = ['admin', 'guru', 'pengajar']
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
  if (kota !== undefined) payloadToUpdate.kota = kota
  if (daerah !== undefined) payloadToUpdate.daerah = daerah
  if (noHp !== undefined) payloadToUpdate.noHp = noHp
  if (fotoProfil !== undefined) payloadToUpdate.fotoProfil = fotoProfil

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
      kota: true,
      daerah: true,
      noHp: true,
      fotoProfil: true,
      status: true,
      createdAt: true
    }
  })

  return userUpdated
}

// ================================================
// DELETE USER — Hapus akun user
// ================================================
const deleteUser = async (id) => {
  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  await prisma.user.delete({
    where: { id }
  })

  return { pesan: 'User berhasil dihapus' }
}

// ================================================
// UPDATE PASSWORD
// ================================================
const updatePassword = async (id, passwordLama, passwordBaru) => {
  const user = await prisma.user.findUnique({
    where: { id }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  const passwordCocok = await bcrypt.compare(passwordLama, user.password)
  if (!passwordCocok) {
    throw new Error('Password lama tidak sesuai')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  })
}

// ================================================
// ADMIN RESET PASSWORD
// ================================================
const adminResetPassword = async (id, passwordBaru) => {
  const user = await prisma.user.findUnique({
    where: { id }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  if (user.role === 'admin') {
    throw new Error('Tidak bisa reset password akun admin')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword }
  })

  return { pesan: `Password user ${user.nama} berhasil direset.` }
}

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updatePassword,
  adminResetPassword
}