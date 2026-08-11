// src/modules/auth/auth.controller.js

const authService = require('./auth.service')

// ================================================
// REGISTER
// ================================================
const register = async (req, res) => {
  try {
    // 1. Ambil data dari request body
    const { nama, email, password } = req.body
    
    // 2. Validasi — pastikan semua field diisi
    if (!nama || !email || !password) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Nama, email, dan password wajib diisi'
      })
    }

    // 3. Validasi format email
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValid) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Format email tidak valid'
      })
    }

    // 4. Validasi panjang password
    if (password.length < 8) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password minimal 8 karakter'
      }) 
    }

    // 5. Panggil service untuk proses register
    const userBaru = await authService.register({ nama, email, password })

    // 6. Kirim response sukses
    return res.status(201).json({
      sukses: true,
      pesan: 'Registrasi berhasil',
      data: userBaru
    })

  } catch (error) {
    // Tangkap error dari service
    // Misalnya: "Email sudah terdaftar"
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// LOGIN
// ================================================
const login = async (req, res) => {
  try {
    // 1. Ambil data dari request body
    const { email, password } = req.body

    // 2. Validasi — pastikan semua field diisi
    if (!email || !password) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email dan password wajib diisi'
      })
    }

    // 3. Panggil service untuk proses login
    const hasil = await authService.login({ email, password })

    // 4. Kirim response sukses + token
    return res.status(200).json({
      sukses: true,
      pesan: 'Login berhasil',
      data: hasil
    })

  } catch (error) {
    return res.status(401).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET ME — Ambil data user yang sedang login
// ================================================
const getMe = async (req, res) => {
  try {
    // req.user diisi oleh auth middleware (akan kita buat nanti)
    return res.status(200).json({
      sukses: true,
      data: req.user
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = { register, login, getMe }