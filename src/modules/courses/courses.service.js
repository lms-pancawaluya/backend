const prisma = require('../../config/database');

class CoursesService {
  // Helper internal untuk melempar error dengan status code HTTP
  createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  // 1. Ambil daftar Course (Filtering Otomatis berdasarkan Role & School)
  async getAllCourses(user, query = {}) {
    const { mode } = query;
    const where = {};

    if (mode) {
      where.mode = mode;
    }

    // LOGIK SCHOOL-SCOPE FILTERING
    if (user && user.role !== 'admin') {
      // Guru & Pengajar hanya melihat:
      // - Course GLOBAL (schoolId: null)
      // - ATAU Course khusus sekolah pengguna (schoolId: user.schoolId)
      where.OR = [
        { schoolId: null },
        { schoolId: user.schoolId || 'NO_SCHOOL_MATCH' },
      ];
    }
    // Note: Admin tidak terkena filter OR (bebas melihat semua Course)

    const courses = await prisma.course.findMany({
      where,
      include: {
        school: {
          select: { id: true, nama: true, npsn: true },
        },
        modules: {
          select: { id: true },
        },
        courseProgress: user?.id
          ? {
              where: { userId: user.id },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return await Promise.all(
      courses.map(async (course) => {
        const totalModules = course.modules.length;
        let completedModulesCount = 0;

        if (user?.id && totalModules > 0) {
          const completedModules = await prisma.user_progress.count({
            where: {
              userId: user.id,
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
          schoolId: course.schoolId,
          school: course.school,
          isGlobal: !course.schoolId,
          createdBy: course.createdBy,
          totalModules,
          completedModules: completedModulesCount,
          progressPercentage,
          statusProgress:
            course.courseProgress?.[0]?.status || 'belum_mulai',
        };
      })
    );
  }

  // 2. Ambil Detail Course + Daftar Modul (Sesuai Access Control)
  async getCourseById(courseId, user) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        school: {
          select: { id: true, nama: true, npsn: true },
        },
        creator: {
          select: { id: true, nama: true, email: true },
        },
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
      throw this.createError('Course tidak ditemukan', 404);
    }

    // Validasi Akses School Scope
    if (course.schoolId) {
      if (!user) {
        throw this.createError('Kamu perlu login untuk mengakses Course sekolah ini', 401);
      }

      if (user.role !== 'admin' && course.schoolId !== user.schoolId) {
        throw this.createError('Kamu tidak memiliki akses ke Course sekolah ini', 403);
      }
    }

    let userProgressMap = {};
    if (user?.id) {
      const progresses = await prisma.user_progress.findMany({
        where: {
          userId: user.id,
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
      const isLocked = !isPreviousModuleCompleted;

      const preTest = module.evaluations.find((e) => e.tipe === 'pre_test');
      const postTest = module.evaluations.find((e) => e.tipe === 'post_test');

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
      schoolId: course.schoolId,
      school: course.school,
      creator: course.creator,
      isGlobal: !course.schoolId,
      createdBy: course.createdBy,
      progressPercentage: courseProgressPercentage,
      isCourseCompleted:
        totalModules > 0 && completedCount === totalModules,
      isCertificateEligible:
        course.hasCertificate && totalModules > 0 && completedCount === totalModules,
      modules: formattedModules,
    };
  }

  // 3. Buat Course Baru (Otomatis Inject createdBy & schoolId)
  async createCourse(data, user) {
    if (!user) {
      throw this.createError('Pengguna tidak terautentikasi', 401);
    }

    // Jika Admin -> schoolId = null (GLOBAL)
    // Jika Pengajar -> schoolId = user.schoolId
    const targetSchoolId = user.role === 'admin' ? null : (user.schoolId || null);

    // Pengajar harus terikat dengan sekolah jika ingin membuat course
    if (user.role === 'pengajar' && !targetSchoolId) {
      throw this.createError('Pengajar harus terhubung dengan sekolah untuk membuat Course', 400);
    }

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
        createdBy: user.id,
        schoolId: targetSchoolId,
      },
      include: {
        school: {
          select: { id: true, nama: true },
        },
      },
    });
  }

  // 4. Update Course (Validasi Ownership & Scope)
  async updateCourse(id, data, user) {
    const existingCourse = await prisma.course.findUnique({ where: { id } });
    if (!existingCourse) {
      throw this.createError('Course tidak ditemukan', 404);
    }

    // Validasi Akses Pengajar
    if (user.role !== 'admin') {
      const isOwner = existingCourse.createdBy === user.id;
      const isSameSchool =
        existingCourse.schoolId && existingCourse.schoolId === user.schoolId;

      if (!isOwner && !isSameSchool) {
        throw this.createError('Kamu tidak memiliki akses untuk mengubah Course ini', 403);
      }
    }

    const {
      judul,
      deskripsi,
      coverUrl,
      mode,
      hasCertificate,
      lokasi,
      tanggalMulai,
      tanggalSelesai,
    } = data;

    return await prisma.course.update({
      where: { id },
      data: {
        judul,
        deskripsi,
        coverUrl,
        mode,
        hasCertificate,
        lokasi,
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : undefined,
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : undefined,
      },
    });
  }

  // 5. Hapus Course (Validasi Ownership & Scope)
  async deleteCourse(id, user) {
    const existingCourse = await prisma.course.findUnique({ where: { id } });
    if (!existingCourse) {
      throw this.createError('Course tidak ditemukan', 404);
    }

    // Validasi Akses Pengajar
    if (user.role !== 'admin') {
      const isOwner = existingCourse.createdBy === user.id;
      const isSameSchool =
        existingCourse.schoolId && existingCourse.schoolId === user.schoolId;

      if (!isOwner && !isSameSchool) {
        throw this.createError('Kamu tidak memiliki akses untuk menghapus Course ini', 403);
      }
    }

    return await prisma.course.delete({
      where: { id },
    });
  }
}

module.exports = new CoursesService();