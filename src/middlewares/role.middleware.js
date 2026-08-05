// src/middlewares/role.middleware.js

// roleMiddleware adalah fungsi yang mengembalikan middleware
// Kenapa begini? Supaya bisa dipakai fleksibel:
// roleMiddleware('admin') → hanya admin
// roleMiddleware('admin', 'guru') → admin dan guru

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user sudah diisi oleh authMiddleware sebelumnya
    const userRole = req.user.role

    // Cek apakah role user ada di daftar role yang diizinkan
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        sukses: false,
        pesan: `Akses ditolak. Hanya ${allowedRoles.join(' dan ')} yang bisa mengakses ini`
      })
    }

    // Role valid → lanjut
    next()
  }
}

module.exports = roleMiddleware