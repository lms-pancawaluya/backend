const prisma = require('../../config/database');

class CoursesService {
  // 1. Ambil daftar semua Course
  async getAllCourses(userId, query = {}) {
    const { mode } = query;
    const where = {};

    if (mode) {
      where.mode = mode;
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        modules: {
          select: { id: true },
        },
        courseProgress: userId
          ? {
              where: { userId },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return await Promise.all(
      courses.map(async (course) => {
        const totalModules = course.modules.length;
        let completedModulesCount = 0;

        if (userId && totalModules > 0) {
          const completedModules = await prisma.user_progress.count({
            where: {
              userId,
              moduleId: { in: course.modules.map((m) => m.id) },
              status: 'selesai',
            },
          });
          completedModulesCount = completedModules;
        }

        const progressPercentage =
          totalModules > 0
            ? Math.round((completedModulesCount / totalModules) * 100)
            : 0;

        return {
          id: course.id,
          judul: course.judul,
          deskripsi: course.deskripsi,
          coverUrl: course.coverUrl,
          mode: course.mode,
          hasCertificate: course.hasCertificate,
          lokasi: course.lokasi,
          tanggalMulai: course.tanggalMulai,
          tanggalSelesai: course.tanggalSelesai,
          totalModules,
          completedModules: completedModulesCount,
          progressPercentage,
          statusProgress:
            course.courseProgress?.[0]?.status || 'belum_mulai',
        };
      })
    );
  }

  // 2. Ambil Detail Course + Daftar Modul (Sesuai Flow Guru & Locking Logic)
  async getCourseById(courseId, userId) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { urutan: 'asc' },
          include: {
            contents: { orderBy: { urutan: 'asc' } },
            evaluations: true,
          },
        },
      },
    });

    if (!course) {
      throw new Error('Course tidak ditemukan');
    }

    let userProgressMap = {};
    if (userId) {
      const progresses = await prisma.user_progress.findMany({
        where: {
          userId,
          moduleId: { in: course.modules.map((m) => m.id) },
        },
      });
      progresses.forEach((p) => {
        userProgressMap[p.moduleId] = p;
      });
    }

    let isPreviousModuleCompleted = true; // Modul 1 selalu terbuka pertama kali

    const formattedModules = course.modules.map((module) => {
      const userProg = userProgressMap[module.id] || null;
      const isCompleted = userProg?.status === 'selesai';

      // Logika Locking: Terkunci jika modul sebelumnya belum selesai
      const isLocked = !isPreviousModuleCompleted;

      // Ambil Pre-Test dan Post-Test
      const preTest = module.evaluations.find((e) => e.tipe === 'pre_test');
      const postTest = module.evaluations.find((e) => e.tipe === 'post_test');

      // Evaluasi kelulusan per step
      const preTestCompleted = !preTest || (userProg?.preTestSkor ?? 0) > 0;
      const postTestCompleted =
        !postTest || (userProg?.skor ?? 0) >= (postTest?.passingScore || 80);

      const moduleData = {
        id: module.id,
        judul: module.judul,
        deskripsi: module.deskripsi,
        urutan: module.urutan,
        aspekPancawaluya: module.aspekPancawaluya,
        isLocked,
        status: userProg?.status || 'belum_mulai',
        flowStatus: {
          preTest: {
            id: preTest?.id || null,
            available: !!preTest,
            isCompleted: preTestCompleted,
          },
          totalMaterials: module.contents.length,
          postTest: {
            id: postTest?.id || null,
            available: !!postTest,
            isLocked: !preTestCompleted,
            isCompleted: postTestCompleted,
          },
        },
      };

      // Set patokan untuk modul berikutnya
      isPreviousModuleCompleted = isCompleted;

      return moduleData;
    });

    const totalModules = course.modules.length;
    const completedCount = formattedModules.filter(
      (m) => m.status === 'selesai'
    ).length;
    const courseProgressPercentage =
      totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

    return {
      id: course.id,
      judul: course.judul,
      deskripsi: course.deskripsi,
      coverUrl: course.coverUrl,
      mode: course.mode,
      hasCertificate: course.hasCertificate,
      lokasi: course.lokasi,
      tanggalMulai: course.tanggalMulai,
      tanggalSelesai: course.tanggalSelesai,
      progressPercentage: courseProgressPercentage,
      isCourseCompleted:
        totalModules > 0 && completedCount === totalModules,
      isCertificateEligible:
        course.hasCertificate && totalModules > 0 && completedCount === totalModules,
      modules: formattedModules,
    };
  }

  // 3. Buat Course Baru
  async createCourse(data) {
    return await prisma.course.create({
      data: {
        judul: data.judul,
        deskripsi: data.deskripsi,
        coverUrl: data.coverUrl,
        mode: data.mode || 'online',
        hasCertificate: data.hasCertificate ?? true,
        lokasi: data.lokasi || null,
        tanggalMulai: data.tanggalMulai ? new Date(data.tanggalMulai) : null,
        tanggalSelesai: data.tanggalSelesai ? new Date(data.tanggalSelesai) : null,
      },
    });
  }

  // 4. Update Course
  async updateCourse(id, data) {
    return await prisma.course.update({
      where: { id },
      data: {
        ...data,
        tanggalMulai: data.tanggalMulai ? new Date(data.tanggalMulai) : undefined,
        tanggalSelesai: data.tanggalSelesai ? new Date(data.tanggalSelesai) : undefined,
      },
    });
  }

  // 5. Hapus Course
  async deleteCourse(id) {
    return await prisma.course.delete({
      where: { id },
    });
  }
}

module.exports = new CoursesService();