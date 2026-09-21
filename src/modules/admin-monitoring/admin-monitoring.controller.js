const adminMonitoringService = require('./admin-monitoring.service')

const getUserModuleProgress = async (req, res) => {
  try {
    const { userId } = req.params
    const data = await adminMonitoringService.getUserModuleProgress(userId)

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

const getAllUsersModuleProgress = async (req, res) => {
  try {
    const data = await adminMonitoringService.getAllUsersModuleProgress(req.user)

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

module.exports = {
  getUserModuleProgress,
  getUserEvaluations,
  getAllUsersModuleProgress
}