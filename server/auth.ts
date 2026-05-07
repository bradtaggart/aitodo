import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    userId: number
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const COOKIE = 'session'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req as Request & { cookies: Record<string, string> }).cookies?.[COOKIE]
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: number }
    req.userId = Number(payload.sub)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

export function setSessionCookie(res: Response, userId: number): void {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE)
}
