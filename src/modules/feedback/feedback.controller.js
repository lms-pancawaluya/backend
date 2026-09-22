const feedbackService = require('./feedback.service')

const createFeedback = async (req, res) => {
  try {
    const userId = req.user.id
    const { courseId } = req.params
    const { saran, masukan, moduleId } = req.body

    const result = await feedbackService.createFeedback(userId, courseId, { 
      saran, 
      masukan, 
      moduleId 
    })

    return res.status(201).json({
      sukses: true,
      pesan: 'Saran dan masukan berhasil dikirim',
      data: result
    })
  } catch (error) {
    const statusCode = error.statusCode || 400

    return res.status(statusCode).json({
      sukses: false,
      pesan: error.message,
      ...(error.data && { data: error.data })
    })
  }
}

const getAllFeedbacks = async (req, res) => {
  try {
    const result = await feedbackService.getAllFeedbacks()

    return res.status(200).json({
      sukses: true,
      jumlah: result.length,
      data: result
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  createFeedback,
  getAllFeedbacks
}