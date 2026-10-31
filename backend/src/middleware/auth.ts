import { NextFunction, Request, Response } from "express";
import { cookieName, adminCookieName, readCustomerToken, readAdminToken, refreshAdminSession, SessionPayload, clearSession, clearAdminSession } from "../lib/auth.js";
import { prisma } from "../database/prisma.js";

declare global { namespace Express { interface Request { session?: SessionPayload } } }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = readCustomerToken(req.cookies?.[cookieName]);
  if (!session) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, blockedAt: true, deletedAt: true } });
    if (!user || user.deletedAt || user.blockedAt || user.role !== "USER") {
      clearSession(res);
      return res.status(401).json({ error: "SESSION_REVOKED" });
    }
    req.session = { userId: session.userId, role: "USER" };
    next();
  } catch (error) { next(error); }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = readAdminToken(req.cookies?.[adminCookieName]);
  if (!session) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, blockedAt: true, deletedAt: true } });
    if (!user || user.deletedAt || user.blockedAt || user.role !== "ADMIN" || session.role !== "ADMIN") {
      clearAdminSession(res);
      return res.status(401).json({ error: "SESSION_REVOKED" });
    }
    req.session = { userId: session.userId, role: "ADMIN" };
    refreshAdminSession(res, req.session);
    next();
  } catch (error) { next(error); }
}
