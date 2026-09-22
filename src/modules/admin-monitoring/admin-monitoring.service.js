const prisma = require('../../config/database')

// Helper untuk format data per user & course
const mapUserCourseData = (userId, course, courseProgressMap, userProgressMap, contentProgressMap, miniQuizAttemptMap) => {
  const courseProgress = courseProgressMap.get(`${userId}_${course.id}`)

  let totalModules = course.modules.length
  let completedModulesCount = 0

  const modulesData = course.modules.map((module) => {
    const modProgress = userProgressMap.get(`${userId}_${module.id}`)

    if (modProgress?.status === 'selesai') {
      completedModulesCount++
    }

    const hasPreTest = module.preTests.length > 0
    const preTestStatus = modProgress
      ? modProgress.preTestSkor !== null && modProgress.preTestSkor !== undefined
        ? 'selesai'
        : 'belum_selesai'
      : 'belum_mulai'
    const preTestNilai = modProgress ? modProgress.preTestSkor : null

    const hasPostTest = module.postTests.length > 0
    const postTestStatus = modProgress ? modProgress.status : 'belum_mulai'
    const postTestNilai = modProgress ? modProgress.skor : null

    const contentsData = module.contents.map((content) => {
      const cProgress = contentProgressMap.get(`${userId}_${content.id}`)
      const miniQuiz = content.miniQuizzes[0] || null
      let interactiveQuestionData = null

      if (miniQuiz) {
        const attempt = miniQuizAttemptMap.get(`${userId}_${miniQuiz.id}`)
        interactiveQuestionData = {
          hasInteractiveQuestion: true,
          miniQuizId: miniQuiz.id,
          judul: miniQuiz.judul,
          status: attempt ? (attempt.isLolos ? 'lolos' : 'tidak_lolos') : 'belum_mengerjakan',
          skor: attempt ? attempt.skor : null,
          attemptsCount: attempt ? attempt.attemptNumber : 0
        }
      } else {
        interactiveQuestionData = {
          hasInteractiveQuestion: false
        }
      }

      return {
        contentId: content.id,
        judul: content.judul,
        tipe: content.tipe,
        urutan: content.urutan,
        isCompleted: cProgress ? cProgress.isCompleted : false,
        progressPercent: cProgress ? cProgress.progress : 0,
        interactiveQuestion: interactiveQuestionData
      }
    })

    const isAllMaterialCompleted = contentsData.every((c) => c.isCompleted)

    return {
      moduleId: module.id,
      judul: module.judul,
      urutan: module.urutan,
      status: modProgress ? modProgress.status : 'belum_mulai',
      preTest: {
        exists: hasPreTest,
        status: preTestStatus,
        nilai: preTestNilai
      },
      learningMaterial: {
        isCompleted: isAllMaterialCompleted,
        contents: contentsData
      },
      postTest: {
        exists: hasPostTest,
        status: postTestStatus,
        nilai: postTestNilai
      }
    }
  })

  const courseProgressPercent = totalModules > 0 ? Math.round((completedModulesCount / totalModules) * 100) : 0

  return {
    courseId: course.id,
    judulCourse: course.judul,
    statusCourse: courseProgress ? courseProgress.status : 'belum_mulai',
    progressPercent: courseProgressPercent,
    completedAt: courseProgress?.completedAt || null,
    modules: modulesData
  }
}

// 1. Progress Learning Per Guru
const getUserLearningProgress = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nama: true, email: true }
  })

  if (!user) {
    throw new Error('User/Guru tidak ditemukan')
  }

  const result = await getAllUsersLearningProgress({ forcedUserId: userId })
  return result[0] || { userId: user.id, namaGuru: user.nama, emailGuru: user.email, courses: [] }
}

// 2. Monitoring Progress SEMUA Guru (Batch Fetching)
const getAllUsersLearningProgress = async (currentUser = {}) => {
  const userWhere = { role: 'guru' }

  if (currentUser.forcedUserId) {
    userWhere.id = currentUser.forcedUserId
  } else if (currentUser.role === 'pengajar') {
    const schoolIdPengajar = currentUser.schoolId
    const sekolahPengajar = currentUser.sekolah

    if (schoolIdPengajar) {
      userWhere.schoolId = schoolIdPengajar
    } else if (sekolahPengajar) {
      userWhere.sekolah = sekolahPengajar
    } else {
      return []
    }
  }

  // Query 1: Users
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, nama: true, email: true }
  })

  if (users.length === 0) return []
  const userIds = users.map((u) => u.id)

  // Query 2: Courses beserta hirarkinya
  const allCourses = await prisma.course.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      judul: true,
      modules: {
        orderBy: { urutan: 'asc' },
        select: {
          id: true,
          judul: true,
          urutan: true,
          preTests: { select: { id: true, judul: true } },
          postTests: { select: { id: true, judul: true } },
          contents: {
            orderBy: { urutan: 'asc' },
            select: {
              id: true,
              judul: true,
              tipe: true,
              urutan: true,
              miniQuizzes: { select: { id: true, judul: true } }
            }
          }
        }
      }
    }
  })

  // Query 3, 4, 5, 6: Batch Fetch Progress Data
  const [courseProgresses, moduleProgresses, contentProgresses, miniQuizAttempts] = await Promise.all([
    prisma.user_course_progress.findMany({ where: { userId: { in: userIds } } }),
    prisma.user_progress.findMany({ where: { userId: { in: userIds } } }),
    prisma.userContentProgress.findMany({ where: { userId: { in: userIds } } }),
    prisma.miniQuizAttempt.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' }
    })
  ])

  // Map data ke HashMap O(1) agar pencarian cepat
  const courseProgressMap = new Map(courseProgresses.map((p) => [`${p.userId}_${p.courseId}`, p]))
  const userProgressMap = new Map(moduleProgresses.map((p) => [`${p.userId}_${p.moduleId}`, p]))
  const contentProgressMap = new Map(contentProgresses.map((p) => [`${p.userId}_${p.contentId}`, p]))

  const miniQuizAttemptMap = new Map()
  miniQuizAttempts.forEach((attempt) => {
    const key = `${attempt.userId}_${attempt.miniQuizId}`
    if (!miniQuizAttemptMap.has(key)) {
      miniQuizAttemptMap.set(key, attempt)
    }
  })

  // Rakit Response
  return users.map((user) => {
    const coursesProgress = allCourses.map((course) =>
      mapUserCourseData(user.id, course, courseProgressMap, userProgressMap, contentProgressMap, miniQuizAttemptMap)
    )

    return {
      userId: user.id,
      namaGuru: user.nama,
      emailGuru: user.email,
      courses: coursesProgress
    }
  })
}

const getUserModuleProgress = async (userId) => {
  return await getUserLearningProgress(userId)
}

module.exports = {
  getUserLearningProgress,
  getAllUsersLearningProgress,
  getUserModuleProgress
}