import multer from 'multer'

// Multer тимчасово зберігає завантажений файл на диску в директорії uploads/.
// Після завантаження на Cloudinary локальна копія видаляється в сервісі
// uploadImage(). Поле форми з файлом називається `image`.
const upload = multer({ dest: 'uploads/' })

export default upload
