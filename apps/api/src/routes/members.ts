import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { addPageMemberByEmail, removePageMember } from "../services/members.js";

export const membersRouter = Router({ mergeParams: true });

membersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const member = await addPageMemberByEmail(
      req.uid!,
      req.params.pageId,
      req.body,
    );
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

membersRouter.delete("/:userId", requireAuth, async (req, res, next) => {
  try {
    await removePageMember(req.uid!, req.params.pageId, req.params.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
