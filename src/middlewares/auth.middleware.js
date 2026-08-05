// src/middlewares/auth.middleware.js

const jwt = require('jsonwebtoken')
const prisma = require('../config/database')

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Ambil token dari header Authorization
    // Format header: "Bearer eyJhbGci..."
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak. Token tidak ditemukan'
      })
    }

    // 2. Ambil token saja, buang kata "Bearer "
    const token = authHeader.split(' ')[1]

    // 3. Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // decoded berisi: { id, email, role, iat, exp }

    // 4. Cari user di database berdasarkan id di token
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true
      }
    })

    if (!user) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak. User tidak ditemukan'
      })
    }

    // 5. Simpan data user ke req.user
    // Supaya bisa diakses di controller berikutnya
    req.user = user

    // 6. Lanjut ke handler berikutnya
    next()

  } catch (error) {
    // Token expired atau tidak valid
    return res.status(401).json({
      sukses: false,
      pesan: 'Akses ditolak. Token tidak valid atau sudah expired'
    })
  }
}

module.exports = authMiddleware