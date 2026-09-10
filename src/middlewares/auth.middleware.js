// src/middlewares/auth.middleware.js

const jwt = require('jsonwebtoken')
const prisma = require('../config/database')

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Ambil token dari header Authorization
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak. Token tidak ditemukan'
      })
    }

    // 2. Ambil token saja (buang "Bearer ")
    const token = authHeader.split(' ')[1]

    // 3. Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 4. Cari user di database berdasarkan id di token
    // PENTING: Tambahkan schoolId & sekolah ke select query
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        schoolId: true, // Digunakan untuk scope filter sekolah
        sekolah: true
      }
    })

    if (!user) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak. User tidak ditemukan'
      })
    }

    // 5. Simpan data user ke req.user
    req.user = user

    // 6. Lanjut ke middleware / controller berikutnya
    next()

  } catch (error) {
    return res.status(401).json({
      sukses: false,
      pesan: 'Akses ditolak. Token tidak valid atau sudah expired'
    })
  }
}

module.exports = authMiddleware