import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import createHttpError from 'http-errors'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import { errors as celebrateErrors } from 'celebrate'
import logger from './src/logger.js'
import announcementsRouter from './src/routes/announcements.routes.js'
import authRouter from './src/routes/auth.routes.js'

const app = express()
const PORT = process.env.PORT || 3000

// Список дозволених origin для CORS береться зі змінної оточення.
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) || []

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Announcements REST API',
      version: '3.0.0',
      description:
        'REST API для дошки оголошень з JWT-автентифікацією, базовою безпекою ' +
        '(helmet, CORS, rate limiting), логуванням через pino та завантаженням ' +
        'фото оголошень у Cloudinary.',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// Обмеження для auth-маршрутів: не більше 10 запитів з однієї IP за 15 хвилин.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

// ── Безпека (порядок важливий) ────────────────────────────────────────────
// 1. CORS — щоб preflight OPTIONS отримав правильні заголовки першим.
app.use(
  cors({
    origin: (origin, callback) => {
      // Дозволяємо запити без Origin (REST Client, curl, server-to-server)
      // та запити з дозволених джерел; решту — відхиляємо з помилкою.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(createHttpError(403, 'Not allowed by CORS'))
    },
    credentials: true,
  }),
)

// 2. Helmet — безпечні HTTP-заголовки до всіх відповідей. CSP вимкнено, щоб
//    не ламати inline-стилі та скрипти сторінки Swagger UI (/api-docs).
app.use(helmet({ contentSecurityPolicy: false }))

// ── Логування ──────────────────────────────────────────────────────────────
// Кожен HTTP-запит логується автоматично; той самий логер доступний як req.log.
app.use(pinoHttp({ logger }))

app.use(express.json())
app.use(cookieParser())

app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Rate limiting підключається лише на auth-маршрути.
app.use('/auth', authLimiter, authRouter)
app.use('/announcements', announcementsRouter)

app.use(celebrateErrors())

// 404 Not Found handler — must come after all routers.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Centralised error handler.
app.use((err, req, res, _next) => {
  logger.error({ err }, 'Request failed')

  // Invalid JSON body
  if (err.type === 'entity.parse.failed' && err.status === 400) {
    return res.status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid JSON',
      validation: {
        body: {
          source: 'body',
          keys: [],
          message: 'Invalid JSON format in request body',
        },
      },
    })
  }

  // createHttpError(401, …), createHttpError(403, …), …
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message })
  }

  // Prisma error codes
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found' })
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Unique constraint violation' })
  }
  if (err.code === 'P2003') {
    return res.status(400).json({
      error: 'Foreign key constraint failed',
      hint:
        'The userId in your JWT does not exist in the database. ' +
        'This usually happens after `prisma migrate reset` — re-register the user via POST /auth/register and use the FRESH access token from the response.',
    })
  }

  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`)
  logger.info(`API docs: http://localhost:${PORT}/api-docs`)
})
