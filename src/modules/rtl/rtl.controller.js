const rtlService = require('./rtl.service')

const uploadRtl = async (req, res) => {
  try {
    const userId = req.user.id
    const hasil = await rtlService.uploadRtl(userId, req.body)

    return res.status(200).json({
      sukses: true,
      pesan: 'File RTL berhasil diunggah dan menunggu peninjauan pengajar',
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getRtlByModule = async (req, res) => {
  try {
    const userId = req.user.id
    const { moduleId } = req.params
    const hasil = await rtlService.getRtlByModule(userId, moduleId)

    return res.status(200).json({
      sukses: true,
      data: hasil || null
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const getAllRtlSubmissions = async (req, res) => {
  try {
    const { status, moduleId } = req.query
    const hasil = await rtlService.getAllRtlSubmissions({ status, moduleId })

    return res.status(200).json({
      sukses: true,
      jumlah: hasil.length,
      data: hasil
    })
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: error.message
    })
  }
}

const reviewRtl = async (req, res) => {
  try {
    const trainerId = req.user.id
    const { rtlId } = req.params
    const hasil = await rtlService.reviewRtl(rtlId, trainerId, req.body)

    return res.status(200).json({
      sukses: true,
      pesan: `Status RTL berhasil diperbarui menjadi ${hasil.status}`,
      data: hasil
    })
  } catch (error) {
    return res.status(400).json({
      sukses: false,
      pesan: error.message
    })
  }
}

module.exports = {
  uploadRtl,
  getRtlByModule,
  getAllRtlSubmissions,
  reviewRtl
}