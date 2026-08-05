// src/modules/auth/auth.service.js

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// ================================================
// REGISTER — Daftarkan user baru
// ================================================
const register = async (data) => {
  const { nama, email, password } = data

  // 1. Hash password sebelum disimpan ke database
  // Angka 10 = "salt rounds" — makin tinggi makin aman tapi makin lambat
  // 10 adalah nilai yang direkomendasikan untuk keseimbangan keamanan & kecepatan
  const hashedPassword = await bcrypt.hash(password, 10)

  // 2. Simpan user baru ke database
  // CATATAN: Bagian ini akan kita lengkapi setelah Prisma siap
  // Untuk sekarang kita return data dulu tanpa database
  const userBaru = {
    nama,
    email,
    password: hashedPassword,
    role: 'guru' // default role saat register adalah guru
  }

  return userBaru
}

// ================================================
// LOGIN — Verifikasi email & password
// ================================================
const login = async (data) => {
  const { email, password } = data

  // CATATAN: Bagian pencarian user dari database
  // akan kita lengkapi setelah Prisma siap
  // Untuk sekarang kita simulasi dulu

  // Simulasi user yang ditemukan di database
  const userDitemukan = {
    id: 1,
    nama: 'Contoh Guru',
    email: email,
    // Ini adalah hash dari password "rahasia123"
    password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    role: 'guru'
  }

  // 1. Cek apakah password yang diinput cocok dengan hash di database
  const passwordCocok = await bcrypt.compare(password, userDitemukan.password)

  if (!passwordCocok) {
    // Lempar error kalau password salah
    // Error ini akan ditangkap oleh controller
    throw new Error('Email atau password salah')
  }

  // 2. Buat JWT token
  const token = jwt.sign(
    // Payload — data yang disimpan di dalam token
    {
      id: userDitemukan.id,
      email: userDitemukan.email,
      role: userDitemukan.role
    },
    // Secret key — dari file .env
    process.env.JWT_SECRET,
    // Options
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  )

  // 3. Return token & data user (tanpa password!)
  return {
    token,
    user: {
      id: userDitemukan.id,
      nama: userDitemukan.nama,
      email: userDitemukan.email,
      role: userDitemukan.role
    }
  }
}

module.exports = { register, login }