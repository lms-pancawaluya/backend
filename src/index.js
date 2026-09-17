// src/index.js

require('dotenv').config()

const app = require('./config/app')
const authRoute = require('./modules/auth/auth.route')
const usersRoute = require('./modules/users/users.route')
const modulesRoute = require('./modules/modules/modules.route')
const contentsRoute = require('./modules/contents/contents.route')
const progressRoute = require('./modules/progress/progress.route')
const rtlRoutes = require('./modules/rtl/rtl.routes')
const miniQuizRoute = require('./modules/mini-quiz/mini-quiz.route')
const uploadRoute = require('./modules/upload/upload.route')
const feedbackRoute = require('./modules/feedback/feedback.route')
const adminMonitoringRoute = require('./modules/admin-monitoring/admin-monitoring.route')
const helpdeskRoutes = require('./modules/helpdesk/helpdesk.routes')
const commentRoutes = require('./modules/comments/comments.routes')
const guruRoute = require('./modules/guru/guru.route')
const notificationRoute = require('./modules/notifications/notifications.route')
const searchRouter = require('./modules/search/search.route')
const courseRoutes = require('./modules/courses/courses.routes');
const certificateRoute = require('./modules/certificates/certificates.route');

const PORT = process.env.PORT || 3000

// ===== DAFTARKAN SEMUA ROUTE =====
app.use('/api/auth', authRoute)
app.use('/api/users', usersRoute)
app.use('/api/modules', modulesRoute)
app.use('/api/contents', contentsRoute)
app.use('/api/progress', progressRoute)
app.use('/api/rtl', rtlRoutes)
app.use('/api/mini-quizzes', miniQuizRoute)
app.use('/api/upload', uploadRoute)
app.use('/api/feedbacks', feedbackRoute)
app.use('/api/admin-monitoring', adminMonitoringRoute)
app.use('/api/helpdesk', helpdeskRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/guru', guruRoute)
app.use('/api/notifications', notificationRoute)
app.use('/api/search', searchRouter)
app.use('/api/courses', courseRoutes);
app.use('/api/certificates', certificateRoute);



// Jalankan server
app.listen(PORT, () => {
  console.log(`Server LMS Pancawaluya berjalan di http://localhost:${PORT}`)
  console.log(`API tersedia di http://localhost:${PORT}/api`)
})