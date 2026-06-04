import bcrypt from 'bcrypt'
import createHttpError from 'http-errors'
import prisma from '../../prisma/client.js'
import logger from '../logger.js'
import {
  clearRefreshTokenCookie,
  createTokens,
  setRefreshTokenCookie,
} from '../services/auth.js'

const BCRYPT_ROUNDS = 10

// Strip sensitive fields before returning a user to the client.
const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  createdAt: user.createdAt,
})

export const register = async (req, res) => {
  const { username, password, name } = req.body

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    throw createHttpError(409, 'User with this username already exists')
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const user = await prisma.user.create({
    data: { username, password: hashedPassword, name },
  })

  const { accessToken, refreshToken } = await createTokens(user.id)
  setRefreshTokenCookie(res, refreshToken)

  logger.info({ userId: user.id, username: user.username }, 'User registered')

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
    },
    accessToken,
    refreshToken,
  })
}

export const login = async (req, res) => {
  const { username, password } = req.body

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    throw createHttpError(401, 'Invalid credentials')
  }

  const passwordMatches = await bcrypt.compare(password, user.password)
  if (!passwordMatches) {
    throw createHttpError(401, 'Invalid credentials')
  }

  // Successful login → rotate refresh tokens (drop every previous one).
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

  const { accessToken, refreshToken } = await createTokens(user.id)
  setRefreshTokenCookie(res, refreshToken)

  logger.info({ userId: user.id, username: user.username }, 'User logged in')

  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
    },
    accessToken,
    refreshToken,
  })
}

export const refresh = async (req, res) => {
  const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken
  if (!incomingToken) {
    throw createHttpError(401, 'Refresh token not provided')
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: incomingToken },
  })
  if (!stored) {
    throw createHttpError(401, 'Invalid refresh token')
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } })
    throw createHttpError(401, 'Refresh token expired')
  }

  // Rotate: drop the old refresh token, mint a fresh pair.
  await prisma.refreshToken.delete({ where: { id: stored.id } })

  const { accessToken, refreshToken } = await createTokens(stored.userId)
  setRefreshTokenCookie(res, refreshToken)

  res.status(200).json({ accessToken, refreshToken })
}

export const logout = async (req, res) => {
  // Drop every refresh token belonging to the current user — anywhere they
  // are signed in. Idempotent: returns 200 even if none were found.
  await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } })
  clearRefreshTokenCookie(res)
  res.status(200).json({ message: 'Logged out successfully' })
}

export const me = async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
  })
  res.status(200).json(publicUser(user))
}
