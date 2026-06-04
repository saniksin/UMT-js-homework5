import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import prisma from '../../prisma/client.js'
import {
  ACCESS_TOKEN_LIFETIME,
  REFRESH_TOKEN_LIFETIME,
} from '../constants/time.js'

// Issues a fresh access/refresh pair, persists the refresh token in the
// database and returns both tokens to the caller.
//
// Both tokens carry a unique `jti` (JWT id). Without it, two calls within
// the same second produce identical JWT strings (because `iat` has second
// granularity), which would break refresh-token rotation: after the
// rotation step `prisma.refreshToken.delete({where:{id}})` we'd insert a
// token with the exact same string as the one just deleted, and the old
// token would still be accepted on subsequent calls.
export const createTokens = async (userId) => {
  const accessToken = jwt.sign(
    { sub: String(userId), jti: crypto.randomBytes(8).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_LIFETIME / 1000 },
  )

  const refreshToken = jwt.sign(
    { sub: String(userId), jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_LIFETIME / 1000 },
  )

  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME),
    },
  })

  return { accessToken, refreshToken }
}

export const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_LIFETIME,
  })
}

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
}
