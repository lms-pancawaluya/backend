// src/modules/auth/auth.service.js

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../../config/database')

// ================================================
// REGISTER — Daftarkan user baru
// ================================================
const register = async (data) => {
  const { nama, email, password, gelar  } = data

  // 1. Cek apakah email sudah terdaftar
  const emailSudahAda = await prisma.user.findUnique({
    where: { email }
  })

  if (emailSudahAda) {
    throw new Error('Email sudah terdaftar')
  }

  // 2. Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // 3. Simpan user baru ke database
  const userBaru = await prisma.user.create({
    data: {
      nama,
      email,
      password: hashedPassword,
      role: 'guru',
      gelar: gelar || null
    },
    // Pilih field yang dikembalikan — jangan kembalikan password!
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      gelar: true, 
      createdAt: true
    }
  })

  return userBaru
}

// ================================================
// LOGIN — Verifikasi email & password
// ================================================
const login = async (data) => {
  const { email, password } = data

  // 1. Cari user berdasarkan email
  const user = await prisma.user.findUnique({
    where: { email }
  })

  // 2. Kalau user tidak ditemukan
  if (!user) {
    throw new Error('Email atau password salah')
  }

  // 3. Verifikasi password
  const passwordCocok = await bcrypt.compare(password, user.password)

  if (!passwordCocok) {
    throw new Error('Email atau password salah')
  }

  // 4. Buat JWT token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  )

  // 5. Return token & data user (tanpa password!)
  return {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      gelar: user.gelar
    }
  }
}

module.exports = { register, login }