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

module.exports = {
  getUserModuleProgress,
  getUserEvaluations
}