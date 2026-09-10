// src/modules/auth/auth.service.js

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../../config/database')
const mailer = require('../../config/mailer')

// ================================================
// HELPER — Generate OTP 6 digit
// ================================================
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ================================================
// REGISTER — Daftarkan user baru + kirim OTP
// ================================================
const register = async (data) => {
  const { nama, email, password, gelar, nip, schoolId, sekolah, kotaKab, kecamatan } = data

  // 1. Cek apakah email sudah terdaftar
  const emailSudahAda = await prisma.user.findUnique({
    where: { email }
  })
  if (emailSudahAda) {
    throw new Error('Email sudah terdaftar')
  }

  // 2. Cek apakah NIP sudah terdaftar (jika NIP diisi)
  if (nip) {
    const nipSudahAda = await prisma.user.findUnique({
      where: { nip }
    })
    if (nipSudahAda) {
      throw new Error('NIP sudah terdaftar pada akun lain')
    }
  }

  // 3. Jika schoolId dikirim, ambil detail MasterSekolah
  let finalSchoolId = schoolId || null
  let finalSekolah = sekolah || null
  let finalKotaKab = kotaKab || null
  let finalKecamatan = kecamatan || null

  if (schoolId) {
    const masterSekolah = await prisma.masterSekolah.findUnique({
      where: { id: schoolId }
    })
    if (masterSekolah) {
      finalSchoolId = masterSekolah.id
      finalSekolah = masterSekolah.nama
      finalKotaKab = masterSekolah.kotaKab
      finalKecamatan = masterSekolah.kecamatan
    }
  }

  // 4. Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // 5. Generate OTP & waktu expired (10 menit)
  const otpCode = generateOtp()
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

  // 6. Simpan user baru dengan isVerified: false
  const userBaru = await prisma.user.create({
    data: {
      nama,
      email,
      password: hashedPassword,
      role: 'guru',
      gelar: gelar || null,
      nip: nip || null,
      schoolId: finalSchoolId,
      sekolah: finalSekolah,
      kotaKab: finalKotaKab,
      kecamatan: finalKecamatan,
      isVerified: false,
      otpCode,
      otpExpiresAt
    },
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
      isVerified: true,
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

  // 7. Kirim OTP ke email
  await mailer.sendOtpRegister(email, otpCode)

  return {
    user: userBaru,
    pesan: 'Registrasi berhasil! Kode OTP telah dikirimkan ke email kamu.'
  }
}

// ================================================
// VERIFY OTP — Verifikasi kode OTP register
// ================================================
const verifyOtp = async (data) => {
  const { email, otpCode } = data

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  if (user.isVerified) {
    throw new Error('Akun ini sudah terverifikasi sebelumnya')
  }

  if (user.otpCode !== otpCode) {
    throw new Error('Kode OTP yang kamu masukkan salah')
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new Error('Kode OTP sudah kadaluwarsa. Silakan minta kode baru.')
  }

  await prisma.user.update({
    where: { email },
    data: {
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null
    }
  })

  return { pesan: 'Verifikasi berhasil! Akun kamu sudah aktif, silakan login.' }
}

// ================================================
// RESEND OTP — Kirim ulang OTP register
// ================================================
const resendOtp = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('Email tidak ditemukan')
  }

  if (user.isVerified) {
    throw new Error('Akun ini sudah terverifikasi')
  }

  const otpCode = generateOtp()
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.user.update({
    where: { email },
    data: { otpCode, otpExpiresAt }
  })

  await mailer.sendOtpRegister(email, otpCode)

  return { pesan: 'Kode OTP baru telah dikirimkan ke email kamu.' }
}

// ================================================
// LOGIN — Bisa pakai email ATAU NIP
// ================================================
const login = async (data) => {
  const { identifier, password } = data

  // 1. Cari user berdasarkan email atau NIP beserta relasi sekolahnya
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { nip: identifier }
      ]
    },
    include: {
      school: {
        select: {
          id: true,
          nama: true,
          npsn: true
        }
      }
    }
  })

  if (!user) {
    throw new Error('Email/NIP atau password salah')
  }

  if (!user.isVerified) {
    throw new Error('Akun kamu belum diverifikasi. Silakan cek email untuk kode OTP.')
  }

  const passwordCocok = await bcrypt.compare(password, user.password)
  if (!passwordCocok) {
    throw new Error('Email/NIP atau password salah')
  }

  // 4. Generate JWT token (Memasukkan schoolId ke payload)
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      sekolah: user.sekolah
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )

  // 5. Return token + data user lengkap
  return {
    token,
    user: {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
      gelar: user.gelar,
      nip: user.nip,
      schoolId: user.schoolId,
      sekolah: user.sekolah,
      school: user.school,
      isVerified: user.isVerified
    }
  }
}

// ================================================
// FORGOT PASSWORD — Kirim OTP reset password
// ================================================
const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('Email tidak terdaftar')
  }

  const otpCode = generateOtp()
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.user.update({
    where: { email },
    data: { otpCode, otpExpiresAt }
  })

  await mailer.sendOtpResetPassword(email, otpCode)

  return { pesan: 'Kode OTP reset password telah dikirimkan ke email kamu.' }
}

// ================================================
// VERIFY RESET OTP — Verifikasi OTP reset password
// ================================================
const verifyResetOtp = async (data) => {
  const { email, otpCode } = data

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  if (user.otpCode !== otpCode) {
    throw new Error('Kode OTP salah')
  }

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new Error('Kode OTP sudah kadaluwarsa')
  }

  await prisma.user.update({
    where: { email },
    data: {
      otpCode: null,
      otpExpiresAt: null
    }
  })

  return { pesan: 'OTP valid. Silakan masukkan password baru.' }
}

// ================================================
// RESET PASSWORD — Ganti password baru (guru sendiri)
// ================================================
const resetPassword = async (data) => {
  const { email, passwordBaru } = data

  if (passwordBaru.length < 8) {
    throw new Error('Password baru minimal 8 karakter')
  }

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  })

  return { pesan: 'Password berhasil direset. Silakan login dengan password baru.' }
}

// ================================================
// ADMIN RESET PASSWORD — Admin reset password guru
// ================================================
const adminResetPassword = async (userId, passwordBaru) => {
  if (!passwordBaru || passwordBaru.length < 8) {
    throw new Error('Password baru minimal 8 karakter')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error('User tidak ditemukan')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  })

  return { pesan: `Password guru ${user.nama} berhasil direset oleh admin.` }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  adminResetPassword
}