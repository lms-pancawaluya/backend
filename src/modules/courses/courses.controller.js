const coursesService = require('./courses.service');

class CoursesController {
  async getAll(req, res, next) {
    try {
      const user = req.user || null;
      const courses = await coursesService.getAllCourses(user, req.query);

      res.status(200).json({
        success: true,
        message: 'Berhasil mengambil daftar course',
        data: courses,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const user = req.user || null;
      const course = await coursesService.getCourseById(req.params.id, user);

      res.status(200).json({
        success: true,
        message: 'Berhasil mengambil detail course',
        data: course,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const newCourse = await coursesService.createCourse(req.body, req.user);

      res.status(201).json({
        success: true,
        message: 'Berhasil membuat course baru',
        data: newCourse,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updatedCourse = await coursesService.updateCourse(
        req.params.id,
        req.body,
        req.user
      );

      res.status(200).json({
        success: true,
        message: 'Berhasil memperbarui course',
        data: updatedCourse,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await coursesService.deleteCourse(req.params.id, req.user);

      res.status(200).json({
        success: true,
        message: 'Berhasil menghapus course',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CoursesController();