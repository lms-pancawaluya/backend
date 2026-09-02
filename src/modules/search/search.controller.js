const searchService = require('./search.service')

const handleGlobalSearch = async (req, res, next) => {
  try {
    const { q } = req.query
    const user = req.user

    // Validasi: Jika user entah bagaimana tidak ada/terautentikasi
    if (!user) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Akses ditolak: User tidak terautentikasi'
      })
    }

    const results = await searchService.globalSearch(q, user)

    return res.status(200).json({
      sukses: true,
      query: q || '',
      data: results
    })
  } catch (error) {
    // Melempar ke error handler Express untuk mengembalikan status 500
    next(error)
  }
}

module.exports = { handleGlobalSearch }