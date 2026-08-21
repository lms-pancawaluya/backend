const usersService = require('./users.service')

// ================================================
// GET ALL USERS — Menerima Query Filter
// ================================================
const getAllUsers = async (req, res) => {
  try {
    const { sekolah, kotaKab, kecamatan, status, search, role } = req.query

    const users = await usersService.getAllUsers({
      sekolah,
      kotaKab,
      kecamatan,
      status,
      search,
      role
    })

    return res.status(200).json({
      sukses: true,
      jumlah: users.length,
      data: users
    })

  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET USER BY ID
// ================================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    // Admin & Pengajar bisa lihat semua, Guru hanya miliknya sendiri
    if (!['admin', 'pengajar'].includes(req.user.role) && req.user.id !== id) {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Kamu tidak bisa melihat data user lain'
      })
    }

    const user = await usersService.getUserById(id)

    return res.status(200).json({
      sukses: true,
      data: user
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE USER
// ================================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { nama, email, role, gelar, nip, sekolah, kotaKab, kecamatan, noHp, fotoProfil, status } = req.body

    // REVISI: Admin & Pengajar bisa update data user lain, Guru hanya bisa update akunnya sendiri
    if (!['admin', 'pengajar'].includes(req.user.role) && req.user.id !== id) {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Kamu tidak bisa mengubah data user lain'
      })
    }

    // Hanya Admin yang bisa mengubah Role
    if (req.user.role !== 'admin' && role) {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Hanya admin yang bisa mengubah role'
      })
    }

    const userUpdated = await usersService.updateUser(id, {
      nama,
      email,
      role,
      gelar,
      nip,
      sekolah,
      kotaKab,
      kecamatan,
      noHp,
      fotoProfil,
      status
    }, req.user) // Passing req.user untuk validasi role pengubah

    return res.status(200).json({
      sukses: true,
      pesan: 'Data user berhasil diupdate',
      data: userUpdated
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// DELETE USER
// ================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Hanya admin yang bisa menghapus user'
      })
    }

    if (req.user.id === id) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Tidak bisa menghapus akun admin sendiri'
      })
    }

    const hasil = await usersService.deleteUser(id)

    return res.status(200).json({
      sukses: true,
      pesan: hasil.pesan
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// GET MY PROFILE
// ================================================
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const user = await usersService.getUserById(userId)

    return res.status(200).json({
      sukses: true,
      data: user
    })

  } catch (error) {
    return res.status(404).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE MY PROFILE
// ================================================
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const { nama, email, gelar, nip, sekolah, kotaKab, kecamatan, noHp } = req.body

    // Pass req.user.role agar service tahu kalau role 'guru' tidak boleh ubah sekolah/lokasi
    const userUpdated = await usersService.updateMyProfile(userId, {
      nama,
      email,
      gelar,
      nip,
      sekolah,
      kotaKab,
      kecamatan,
      noHp
    }, req.user.role)

    return res.status(200).json({
      sukses: true,
      pesan: 'Profil berhasil diupdate',
      data: userUpdated
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// UPDATE PASSWORD
// ================================================
const updatePassword = async (req, res) => {
  try {
    const userId = req.user.id
    const { passwordLama, passwordBaru } = req.body

    if (!passwordLama || !passwordBaru) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password lama dan password baru wajib diisi'
      })
    }

    if (passwordBaru.length < 8) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password baru minimal 8 karakter'
      })
    }

    await usersService.updatePassword(userId, passwordLama, passwordBaru)

    return res.status(200).json({
      sukses: true,
      pesan: 'Password berhasil diupdate'
    })

  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// ================================================
// ADMIN RESET PASSWORD
// ================================================
const adminResetPassword = async (req, res) => {
  try {
    const { id } = req.params
    const { passwordBaru } = req.body

    if (!passwordBaru) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password baru wajib diisi'
      })
    }

    if (passwordBaru.length < 8) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Password baru minimal 8 karakter'
      })
    }

    const hasil = await usersService.adminResetPassword(id, passwordBaru)

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

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getMyProfile,
  updateMyProfile,
  updatePassword,
  adminResetPassword
}