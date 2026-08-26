const commentService = require('./comments.service')

const createComment = async (req, res) => {
  try {
    const userId = req.user.id
    const result = await commentService.createComment(userId, req.body)

    return res.status(201).json({
      sukses: true,
      pesan: 'Komentar berhasil ditambahkan',
      data: result
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getCommentsByModule = async (req, res) => {
  try {
    const { moduleId } = req.params
    const result = await commentService.getCommentsByModule(moduleId)

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

const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const { id } = req.params

    const result = await commentService.deleteComment(id, userId, userRole)

    return res.status(200).json({
      sukses: true,
      pesan: result.pesan
    })
  } catch (error) {
    return res.status(403).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  createComment,
  getCommentsByModule,
  deleteComment
}