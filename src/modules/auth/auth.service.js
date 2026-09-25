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
// HELPER — Sanitize NIP (Hanya Angka)
// ================================================
const sanitizeNip = (nip) => {
  if (!nip) return null
  const cleaned = String(nip).replace(/[^0-9]/g, '').trim()
  return cleaned.length > 0 ? cleaned : null
}

// ================================================
// REGISTER MANDIRI — Daftarkan user baru + kirim OTP
// ================================================
const register = async (data) => {
  const { nama, email, password, gelar, nip, schoolId, sekolah, kotaKab, kecamatan } = data

  const cleanNip = sanitizeNip(nip)

  // 1. Cek apakah email sudah terdaftar
  const emailSudahAda = await prisma.user.findUnique({
    where: { email }
  })
  if (emailSudahAda) {
    throw new Error('Email sudah terdaftar')
  }

  // 2. Cek apakah NIP sudah terdaftar (jika NIP diisi)
  if (cleanNip) {
    const nipSudahAda = await prisma.user.findUnique({
      where: { nip: cleanNip }
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
      nip: cleanNip,
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
// REGISTER GURU (OLEH ADMIN / PENGAJAR)
// Auto lookup MasterGuru + Enforce School Scope + Direct Verified
// ================================================
const registerGuru = async (data, currentUser) => {
  const { nip, email, password } = data

  // 1. Validasi input dasar
  if (!nip || !email || !password) {
    throw new Error('NIP, email, dan password wajib diisi')
  }

  if (password.length < 8) {
    throw new Error('Password minimal 8 karakter')
  }

  // Bersihkan NIP dari karakter strip/spasi
  const cleanNip = sanitizeNip(nip)
  if (!cleanNip) {
    throw new Error('Format NIP tidak valid')
  }

  // 2. Cek ketersediaan email
  const emailExist = await prisma.user.findUnique({ where: { email } })
  if (emailExist) {
    throw new Error('Email sudah terdaftar')
  }

  // 3. Cek ketersediaan NIP pada tabel User
  const nipExist = await prisma.user.findUnique({ where: { nip: cleanNip } })
  if (nipExist) {
    throw new Error('NIP sudah terdaftar pada akun lain')
  }

  // 4. Lookup data profil dari MasterGuru menggunakan NIP yang sudah dibersihkan
  const masterGuru = await prisma.masterGuru.findUnique({
    where: { nip: cleanNip }
  })
  if (!masterGuru) {
    throw new Error('Data NIP tidak ditemukan pada Master Guru.')
  }

  // 5. Penegakan School Scope untuk Pengajar
  if (currentUser && currentUser.role === 'pengajar') {
    if (currentUser.schoolId && masterGuru.schoolId && currentUser.schoolId !== masterGuru.schoolId) {
      throw new Error('Akses ditolak. Pengajar hanya bisa mendaftarkan Guru dari sekolah yang sama.')
    }
  }

  // 6. Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // 7. Buat user Guru baru (Langsung isVerified: true)
  const userBaru = await prisma.user.create({
    data: {
      nama: masterGuru.namaGuru || masterGuru.nama,
      email,
      password: hashedPassword,
      role: 'guru',
      nip: masterGuru.nip,
      schoolId: masterGuru.schoolId || currentUser?.schoolId || null,
      sekolah: masterGuru.namaSekolah,
      kotaKab: masterGuru.kotaKab,
      kecamatan: masterGuru.kecamatan,
      isVerified: true
    },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      nip: true,
      schoolId: true,
      sekolah: true,
      kotaKab: true,
      kecamatan: true,
      isVerified: true,
      createdAt: true
    }
  })

  return {
    user: userBaru,
    pesan: 'Akun Guru berhasil dibuat.'
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
// LOGIN — Bisa pakai email ATAU NIP (Support DB Campuran Strip/Polos)
// ================================================
const login = async (data) => {
  const { identifier, password } = data

  if (!identifier || !password) {
    throw new Error('Email/NIP dan password wajib diisi')
  }

  const rawInput = String(identifier).trim()
  const cleanInput = sanitizeNip(rawInput)

  // 1. Pencarian TINGKAT 1: Match persis (Email / NIP persis sama)
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: rawInput },
        { nip: rawInput },
        ...(cleanInput ? [{ nip: cleanInput }] : [])
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

  // 2. Pencarian TINGKAT 2: Jika belum ketemu dan input mengandung angka NIP,
  // cari ke DB dengan membandingkan NIP polosnya (menghapus strip di data DB)
  if (!user && cleanInput) {
    const allUsersWithNip = await prisma.user.findMany({
      where: {
        nip: { not: null }
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

    user = allUsersWithNip.find(u => sanitizeNip(u.nip) === cleanInput)
  }

  // 3. Validasi Keberadaan User
  if (!user) {
    throw new Error('Email/NIP atau password salah')
  }

  // 4. Validasi Status Verifikasi
  if (!user.isVerified) {
    throw new Error('Akun kamu belum diverifikasi. Silakan cek email untuk kode OTP.')
  }

  // 5. Validasi Password
  const passwordCocok = await bcrypt.compare(password, user.password)
  if (!passwordCocok) {
    throw new Error('Email/NIP atau password salah')
  }

  // 6. Generate JWT Token
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

  // Simpan penanda bahwa OTP sudah valid dan perpanjang sesi reset selama 15 menit
  await prisma.user.update({
    where: { email },
    data: {
      otpCode: 'VERIFIED_RESET',
      otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
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

  // Cek validasi penanda OTP sebelum memperbolehkan pergantian password
  if (user.otpCode !== 'VERIFIED_RESET' || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new Error('Sesi reset password tidak valid atau sudah kadaluwarsa. Silakan lakukan verifikasi OTP ulang.')
  }

  const hashedPassword = await bcrypt.hash(passwordBaru, 10)

  await prisma.user.update({
    where: { email },
    data: { 
      password: hashedPassword,
      otpCode: null,
      otpExpiresAt: null
    }
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
  registerGuru,
  verifyOtp,
  resendOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  adminResetPassword
}