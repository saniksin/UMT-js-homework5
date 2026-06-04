import createHttpError from 'http-errors'
import prisma from '../../prisma/client.js'
import logger from '../logger.js'
import { uploadImage } from '../services/cloudinary.js'

const PER_PAGE = 10

export const listAnnouncements = async (req, res) => {
  const search = (req.query.search ?? '').trim()
  const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest'
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1

  const where = {}
  if (search) {
    where.title = { contains: search }
  }

  const orderBy = sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' }

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.announcement.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  res.json({
    data,
    pagination: {
      total,
      page,
      totalPages,
      perPage: PER_PAGE,
    },
  })
}

export const getAnnouncementById = async (req, res) => {
  const id = Number(req.params.id)
  const announcement = await prisma.announcement.findUniqueOrThrow({
    where: { id },
  })
  res.json(announcement)
}

export const createAnnouncement = async (req, res) => {
  const data = { ...req.body, userId: req.user.id }

  // Фото опціональне: якщо файл надіслано — заливаємо його на Cloudinary і
  // зберігаємо лише отриманий URL, локальний файл видаляється всередині сервісу.
  if (req.file) {
    data.imageUrl = await uploadImage(req.file.path)
    logger.info({ userId: req.user.id }, 'Announcement photo uploaded')
  }

  const announcement = await prisma.announcement.create({ data })

  logger.info(
    { announcementId: announcement.id, userId: req.user.id },
    'Announcement created',
  )

  res.status(201).json(announcement)
}

export const updateAnnouncement = async (req, res) => {
  const id = Number(req.params.id)

  // Оновлювати можна текстові поля, фото або і те, й інше — але хоч щось.
  if (Object.keys(req.body).length === 0 && !req.file) {
    throw createHttpError(400, 'Nothing to update')
  }

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) {
    throw createHttpError(404, 'Resource not found')
  }
  if (existing.userId !== req.user.id) {
    throw createHttpError(403, 'Access denied')
  }

  const data = { ...req.body }

  if (req.file) {
    data.imageUrl = await uploadImage(req.file.path)
    logger.info(
      { announcementId: id, userId: req.user.id },
      'Announcement photo uploaded',
    )
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data,
  })
  res.json(announcement)
}

export const deleteAnnouncement = async (req, res) => {
  const id = Number(req.params.id)

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) {
    throw createHttpError(404, 'Resource not found')
  }
  if (existing.userId !== req.user.id) {
    throw createHttpError(403, 'Access denied')
  }

  await prisma.announcement.delete({ where: { id } })
  res.status(204).end()
}
