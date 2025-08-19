import express, { Request, Response } from "express";

export function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
