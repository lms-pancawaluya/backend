// src/modules/users/users.controller.js

const usersService = require('./users.service')

// ================================================
// GET ALL USERS — Ambil semua guru
// ================================================
const getAllUsers = async (req, res) => {
  try {
    const users = await usersService.getAllUsers()

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
// GET USER BY ID — Ambil detail satu user
// ================================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    // Cegah IDOR — guru hanya bisa lihat datanya sendiri
    // Admin bisa lihat semua
    if (req.user.role !== 'admin' && req.user.id !== id) {
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
// UPDATE USER — Update data guru
// ================================================
const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { nama, email, role, gelar, nip, sekolah, noHp } = req.body // ← tambah role

    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Kamu tidak bisa mengubah data user lain'
      })
    }

    if (req.user.role !== 'admin' && role) {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Hanya admin yang bisa mengubah role'
      })
    }

    const userUpdated = await usersService.updateUser(id, { // ← ganti userId → id
      nama,
      email,
      role,
      gelar,
      nip,
      sekolah,
      noHp
    })

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
// DELETE USER — Hapus akun guru
// ================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    // Hanya admin yang bisa hapus user
    // Sudah diproteksi di route, tapi double check di sini
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        sukses: false,
        pesan: 'Akses ditolak. Hanya admin yang bisa menghapus user'
      })
    }

    // Admin tidak boleh hapus dirinya sendiri
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
// GET MY PROFILE — Guru lihat profil sendiri
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
// UPDATE MY PROFILE — Guru update profil sendiri
// ================================================
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id
    const { nama, email, gelar, nip, sekolah, noHp } = req.body // ← tambah gelar

    const userUpdated = await usersService.updateUser(userId, {
      nama,
      email,
      gelar,  // ← tambah gelar
      nip,
      sekolah,
      noHp
    })

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
// UPDATE PASSWORD — Guru ganti password
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
// ADMIN RESET PASSWORD — Admin reset password guru
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