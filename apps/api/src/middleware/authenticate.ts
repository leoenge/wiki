import type { NextFunction, Request, Response } from "express";

import { parseBearerToken, verifySupabaseToken } from "../auth.js";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }

  try {
    req.uid = await verifySupabaseToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
