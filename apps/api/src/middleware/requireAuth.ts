import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../http.js";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.uid) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }
  next();
}
