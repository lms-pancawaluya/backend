const adminMonitoringService = require('./admin-monitoring.service')

/**
 * Mengambil progress pembelajaran (Course -> Module -> Stage) untuk 1 Guru tertentu
 */
const getUserLearningProgress = async (req, res) => {
  try {
    const { userId } = req.params
    // Menggunakan getUserLearningProgress dari service
    const data = await adminMonitoringService.getUserLearningProgress(userId)

    return res.status(200).json({
      sukses: true,
      data
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

/**
 * Mengambil progress pembelajaran (Course -> Module -> Stage) untuk SEMUA Guru
 * (Otomatis di-scope per sekolah jika req.user.role === 'pengajar')
 */
const getAllUsersLearningProgress = async (req, res) => {
  try {
    // Menggunakan getAllUsersLearningProgress dari service
    const data = await adminMonitoringService.getAllUsersLearningProgress(req.user)

    return res.status(200).json({
      sukses: true,
      jumlah: data.length,
      data
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

/**
 * Mengambil data evaluasi user (jika fitur evaluasi dipisah)
 */
const getUserEvaluations = async (req, res) => {
  try {
    const { userId } = req.params
    const data = await adminMonitoringService.getUserEvaluations(userId)

    return res.status(200).json({
      sukses: true,
      data
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500
    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

// Aliases untuk backward compatibility jika masih ada route lama yang memanggil nama ini
const getUserModuleProgress = getUserLearningProgress
const getAllUsersModuleProgress = getAllUsersLearningProgress

module.exports = {
  getUserLearningProgress,
  getAllUsersLearningProgress,
  getUserEvaluations,
  getUserModuleProgress,
  getAllUsersModuleProgress
}