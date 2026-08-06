// src/index.js

const app = require('./config/app')
const authRoute = require('./modules/auth/auth.route')
const usersRoute = require('./modules/users/users.route')
const modulesRoute = require('./modules/modules/modules.route')
const contentsRoute = require('./modules/contents/contents.route')

const PORT = process.env.PORT || 3000

// ===== DAFTARKAN SEMUA ROUTE =====
// Semua route auth akan diawali dengan /api/auth
app.use('/api/auth', authRoute)
app.use('/api/users', usersRoute)
app.use('/api/modules', modulesRoute)
app.use('/api/contents', contentsRoute)

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server LMS Pancawaluya berjalan di http://localhost:${PORT}`)
  console.log(`API tersedia di http://localhost:${PORT}/api`)
})