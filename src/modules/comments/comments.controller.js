// src/modules/comments/comments.controller.js

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

// Mendukung pencarian komentar via Params maupun Query (`courseId` atau `moduleId`)
const getComments = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.query.courseId
    const moduleId = req.params.moduleId || req.query.moduleId

    const result = await commentService.getCommentsByCourse(courseId, moduleId)

    return res.status(200).json({
      sukses: true,
      jumlah: result.length,
      data: result
    })
  } catch (error) {
    return res.status(400).json({
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

// Controller untuk pencarian user (autocomplete `@mention`)
const getMentionableUsers = async (req, res) => {
  try {
    const { q } = req.query
    const result = await commentService.searchMentionableUsers(q)

    return res.status(200).json({
      sukses: true,
      data: result
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  createComment,
  getComments,
  deleteComment,
  getMentionableUsers
}