// src/modules/auth/auth.controller.js

const authService = require('./auth.service')

// ================================================
// REGISTER
// ================================================
const register = async (req, res) => {
  try {
    // 1. Ambil data dari request body (termasuk gelar & nip)
    const { nama, email, password, gelar, nip } = req.body

    // 2. Validasi — pastikan semua field wajib diisi
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

    // 5. Panggil service untuk proses register (teruskan gelar & nip)
    const hasil = await authService.register({ nama, email, password, gelar, nip })

    // 6. Kirim response sukses
    return res.status(201).json({
      sukses: true,
      pesan: hasil.pesan,
      data: hasil.user
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// VERIFY OTP (REGISTER)
// ================================================
const verifyOtp = async (req, res) => {
  try {
    const { email, otpCode } = req.body

    if (!email || !otpCode) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email dan kode OTP wajib diisi'
      })
    }

    const hasil = await authService.verifyOtp({ email, otpCode })

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// RESEND OTP (REGISTER)
// ================================================
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email wajib diisi'
      })
    }

    const hasil = await authService.resendOtp(email)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// LOGIN — Bisa pakai Email ATAU NIP
// ================================================
const login = async (req, res) => {
  try {
    // Menerima identifier (Email atau NIP) atau email (untuk dukungan versi lama)
    const { identifier, email, password } = req.body
    const loginIdentifier = identifier || email

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email/NIP dan password wajib diisi'
      })
    }

    const hasil = await authService.login({ identifier: loginIdentifier, password })

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
// FORGOT PASSWORD — Kirim OTP Reset
// ================================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email wajib diisi'
      })
    }

    const hasil = await authService.forgotPassword(email)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// VERIFY RESET OTP
// ================================================
const verifyResetOtp = async (req, res) => {
  try {
    const { email, otpCode } = req.body

    if (!email || !otpCode) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email dan kode OTP wajib diisi'
      })
    }

    const hasil = await authService.verifyResetOtp({ email, otpCode })

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// RESET PASSWORD (USER / GURU)
// ================================================
const resetPassword = async (req, res) => {
  try {
    const { email, passwordBaru } = req.body

    if (!email || !passwordBaru) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Email dan password baru wajib diisi'
      })
    }

    const hasil = await authService.resetPassword({ email, passwordBaru })

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// ADMIN RESET PASSWORD GURU
// ================================================
const adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params
    const { passwordBaru } = req.body

    if (!passwordBaru) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password baru wajib diisi'
      })
    }

    const hasil = await authService.adminResetPassword(userId, passwordBaru)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })
  } catch (error) {
    return res.status(400).json({
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

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  adminResetPassword,
  getMe
}