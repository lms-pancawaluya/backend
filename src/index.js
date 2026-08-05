// src/index.js

const app = require('./config/app')

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`✅ Server LMS Pancawaluya berjalan di http://localhost:${PORT}`)
})