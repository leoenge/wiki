import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { getInvitePreview, joinPageByInvite } from "../services/invites.js";

export const invitesRouter = Router();

invitesRouter.get("/:token", async (req, res, next) => {
  try {
    const preview = await getInvitePreview(req.params.token);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

invitesRouter.post("/:token/join", requireAuth, async (req, res, next) => {
  try {
    const page = await joinPageByInvite(req.uid!, req.params.token);
    res.json(page);
  } catch (error) {
    next(error);
  }
});
