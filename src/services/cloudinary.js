import fs from 'node:fs/promises'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Завантажує локальний тимчасовий файл на Cloudinary і повертає secure_url.
// Локальна копія видаляється у блоці finally в будь-якому випадку — навіть
// якщо завантаження впало, щоб не залишати сміття в uploads/.
export const uploadImage = async (filePath) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'announcements',
    })
    return result.secure_url
  } finally {
    await fs.unlink(filePath).catch(() => {})
  }
}

export default cloudinary
