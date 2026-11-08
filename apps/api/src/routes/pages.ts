import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import {
  discardPageDraft,
  getPageDraft,
  publishPageDraft,
  upsertPageDraft,
} from "../services/drafts.js";
import { postElementComment } from "../services/comments.js";
import { createPage, updatePage } from "../services/pages.js";
import { upsertItemReview } from "../services/reviews.js";
import { membersRouter } from "./members.js";

export const pagesRouter = Router();

pagesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const page = await createPage(req.uid!, req.body);
    res.status(201).json(page);
  } catch (error) {
    next(error);
  }
});

pagesRouter.patch("/:pageId", requireAuth, async (req, res, next) => {
  try {
    const page = await updatePage(req.uid!, req.params.pageId, req.body);
    res.json(page);
  } catch (error) {
    next(error);
  }
});

pagesRouter.get("/:pageId/draft", requireAuth, async (req, res, next) => {
  try {
    const draft = await getPageDraft(req.uid!, req.params.pageId);
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

pagesRouter.put("/:pageId/draft", requireAuth, async (req, res, next) => {
  try {
    const draft = await upsertPageDraft(req.uid!, req.params.pageId, req.body);
    res.json(draft);
  } catch (error) {
    next(error);
  }
});

pagesRouter.post(
  "/:pageId/draft/publish",
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await publishPageDraft(
        req.uid!,
        req.params.pageId,
        req.body,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

pagesRouter.delete("/:pageId/draft", requireAuth, async (req, res, next) => {
  try {
    await discardPageDraft(req.uid!, req.params.pageId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

pagesRouter.put(
  "/:pageId/items/:itemId/review",
  requireAuth,
  async (req, res, next) => {
    try {
      const review = await upsertItemReview(
        req.uid!,
        req.params.pageId,
        req.params.itemId,
        req.body,
      );
      res.json(review);
    } catch (error) {
      next(error);
    }
  },
);

pagesRouter.post(
  "/:pageId/elements/:elementId/comments",
  requireAuth,
  async (req, res, next) => {
    try {
      const comment = await postElementComment(
        req.uid!,
        req.params.pageId,
        req.params.elementId,
        req.body,
      );
      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  },
);

pagesRouter.use("/:pageId/members", membersRouter);
