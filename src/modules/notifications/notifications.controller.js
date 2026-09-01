const notificationService = require('./notifications.service')

const getMyNotifications = async (req, res) => {
  try {
    const data = await notificationService.getMyNotifications(req.user.id)
    res.json({
      sukses: true,
      data
    })
  } catch (error) {
    res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getUnreadCount = async (req, res) => {
  try {
    const data = await notificationService.getUnreadCount(req.user.id)
    res.json({
      sukses: true,
      data
    })
  } catch (error) {
    res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params
    const data = await notificationService.markAsRead(id, req.user.id)
    res.json({
      sukses: true,
      pesan: 'Notifikasi berhasil ditandai dibaca',
      data
    })
  } catch (error) {
    const statusCode = error.message.includes('tidak memiliki akses') ? 403 : 400
    res.status(statusCode).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const markAllAsRead = async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id)
    res.json({
      sukses: true,
      pesan: result.pesan
    })
  } catch (error) {
    res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
}