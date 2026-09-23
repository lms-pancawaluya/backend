// src/modules/users/users.service.js

const bcrypt = require('bcryptjs')
const prisma = require('../../config/database')

// ================================================
// GET ALL USERS — Ambil semua user dengan Filter & Scope Role
// ================================================
const getAllUsers = async (filters = {}, currentUser = {}) => {
  const { sekolah, kotaKab, kecamatan, status, search, role } = filters

  const whereClause = {}

  // 1. LOGIKA SCOPING UNTUK ROLE PENGAJAR
  if (currentUser.role === 'pengajar') {
    whereClause.role = 'guru'
    
    let schoolIdPengajar = currentUser.schoolId
    let sekolahPengajar = currentUser.sekolah

    if (!schoolIdPengajar && !sekolahPengajar && currentUser.id) {
      const dbPengajar = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { schoolId: true, sekolah: true }
      })
      schoolIdPengajar = dbPengajar?.schoolId
      sekolahPengajar = dbPengajar?.sekolah
    }

    if (schoolIdPengajar) {
      whereClause.schoolId = schoolIdPengajar
    } else if (sekolahPengajar) {
      whereClause.sekolah = sekolahPengajar
    }
  } else {
    if (role) whereClause.role = role
    if (sekolah) whereClause.sekolah = { contains: sekolah, mode: 'insensitive' }
  }

  // 2. Filter opsional lainnya
  if (kotaKab) whereClause.kotaKab = { contains: kotaKab, mode: 'insensitive' }
  if (kecamatan) whereClause.kecamatan = { contains: kecamatan, mode: 'insensitive' }
  if (status) whereClause.status = status

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
      schoolId: true,
      sekolah: true,
      kotaKab: true,
      kecamatan: true,
      noHp: true,
      fotoProfil: true,
      status: true,
      notificationsEnabled: true,
      createdAt: true,
      school: {
        select: {
          id: true,
          nama: true,
          npsn: true
        }
      },
      progress: {
        where: { status: 'selesai' },
        select: { id: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return users.map(user => {
    const userProgressList = user.progress || []
    return {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      gelar: user.gelar,
      nip: user.nip,
      schoolId: user.schoolId,
      sekolah: user.sekolah,
      kotaKab: user.kotaKab,
      kecamatan: user.kecamatan,
      noHp: user.noHp,
      fotoProfil: user.fotoProfil,
      status: user.status,
      notificationsEnabled: user.notificationsEnabled,
      createdAt: user.createdAt,
      school: user.school,
      modulSelesai: userProgressList.length
    }
  })
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
      schoolId: true,
      sekolah: true,
      kotaKab: true,
      kecamatan: true,
      noHp: true,
      fotoProfil: true,
      status: true,
      notificationsEnabled: true,
      createdAt: true,
      school: {
        select: {
          id: true,
          nama: true,
          npsn: true,
          bentuk: true,
          status: true
        }
      },
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
// UPDATE USER (BY ADMIN & PENGAJAR)
// ================================================
const updateUser = async (id, data, currentUser) => {
  const { nama, email, role, gelar, nip, schoolId, sekolah, kotaKab, kecamatan, noHp, fotoProfil, status } = data

  const userAda = await prisma.user.findUnique({
    where: { id }
  })

  if (!userAda) {
    throw new Error('User tidak ditemukan')
  }

  if (currentUser && currentUser.role === 'pengajar' && userAda.role !== 'guru') {
    throw new Error('Akses ditolak. Pengajar hanya bisa mengubah data Guru.')
  }

  const payloadToUpdate = {}

  if (nama) payloadToUpdate.nama = nama

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
  if (nip !== undefined) payloadToUpdate.nip = nip

  if (schoolId) {
    const masterSekolah = await prisma.masterSekolah.findUnique({
      where: { id: schoolId }
    })
    if (masterSekolah) {
      payloadToUpdate.schoolId = masterSekolah.id
      payloadToUpdate.sekolah = masterSekolah.nama
      payloadToUpdate.kotaKab = masterSekolah.kotaKab
      payloadToUpdate.kecamatan = masterSekolah.kecamatan
    }
  } else {
    if (sekolah !== undefined) payloadToUpdate.sekolah = sekolah
    if (kotaKab !== undefined) payloadToUpdate.kotaKab = kotaKab
    if (kecamatan !== undefined) payloadToUpdate.kecamatan = kecamatan
  }

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

  return await prisma.user.update({
    where: { id },
    data: payloadToUpdate,
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      gelar: true,
      nip: true,
      schoolId: true,
      sekolah: true,
      kotaKab: true,
      kecamatan: true,
      noHp: true,
      fotoProfil: true,
      status: true,
      notificationsEnabled: true,
      createdAt: true,
      school: {
        select: {
          id: true,
          nama: true,
          npsn: true
        }
      }
    }
  })
}

// ================================================
// UPDATE MY PROFILE (DIBATASI KHUSUS ROLE GURU)
// ================================================
const updateMyProfile = async (userId, data, userRole) => {
  const { nama, email, gelar, nip, schoolId, sekolah, kotaKab, kecamatan, noHp } = data

  const userAda = await prisma.user.findUnique({ where: { id: userId } })
  if (!userAda) throw new Error('User tidak ditemukan')

  const payloadToUpdate = {}

  if (nama) payloadToUpdate.nama = nama
  if (gelar !== undefined) payloadToUpdate.gelar = gelar
  if (nip !== undefined) payloadToUpdate.nip = nip
  if (noHp !== undefined) payloadToUpdate.noHp = noHp

  if (userRole !== 'guru') {
    if (schoolId) {
      const masterSekolah = await prisma.masterSekolah.findUnique({
        where: { id: schoolId }
      })
      if (masterSekolah) {
        payloadToUpdate.schoolId = masterSekolah.id
        payloadToUpdate.sekolah = masterSekolah.nama
        payloadToUpdate.kotaKab = masterSekolah.kotaKab
        payloadToUpdate.kecamatan = masterSekolah.kecamatan
      }
    } else {
      if (sekolah !== undefined) payloadToUpdate.sekolah = sekolah
      if (kotaKab !== undefined) payloadToUpdate.kotaKab = kotaKab
      if (kecamatan !== undefined) payloadToUpdate.kecamatan = kecamatan
    }
  }

  if (email && email !== userAda.email) {
    const emailSudahAda = await prisma.user.findUnique({ where: { email } })
    if (emailSudahAda) throw new Error('Email sudah digunakan user lain')
    payloadToUpdate.email = email
  }

  return await prisma.user.update({
    where: { id: userId },
    data: payloadToUpdate,
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      gelar: true,
      nip: true,
      schoolId: true,
      sekolah: true,
      kotaKab: true,
      kecamatan: true,
      noHp: true,
      fotoProfil: true,
      status: true,
      notificationsEnabled: true,
      createdAt: true,
      school: {
        select: {
          id: true,
          nama: true,
          npsn: true
        }
      }
    }
  })
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

// ================================================
// NOTIFICATION PREFERENCE (BARU)
// ================================================
const getNotificationPreference = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsEnabled: true }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  return {
    notificationsEnabled: user.notificationsEnabled ?? true
  }
}

const updateNotificationPreference = async (userId, notificationsEnabled) => {
  if (typeof notificationsEnabled !== 'boolean') {
    throw new Error('Field notificationsEnabled harus berupa boolean (true/false)')
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { notificationsEnabled },
    select: { notificationsEnabled: true }
  })

  return {
    notificationsEnabled: updatedUser.notificationsEnabled
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  updateMyProfile,
  deleteUser,
  updatePassword,
  adminResetPassword,
  getNotificationPreference,
  updateNotificationPreference
}