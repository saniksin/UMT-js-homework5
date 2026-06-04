import jwt from 'jsonwebtoken'
import createHttpError from 'http-errors'

// Verifies a Bearer JWT and exposes the user id under `req.user.id`.
const authenticate = (req, _res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    throw createHttpError(401, 'Authentication required')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = { id: Number(decoded.sub) }
    next()
  } catch {
    throw createHttpError(401, 'Invalid or expired token')
  }
}

export default authenticate
