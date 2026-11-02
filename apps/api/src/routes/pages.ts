import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { createElement, reorderElements, updateElement } from "../services/elements.js";
import { createPage, updatePage } from "../services/pages.js";

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

pagesRouter.post("/:pageId/elements", requireAuth, async (req, res, next) => {
  try {
    const element = await createElement(req.uid!, req.params.pageId, req.body);
    res.status(201).json(element);
  } catch (error) {
    next(error);
  }
});

pagesRouter.put(
  "/:pageId/elements/reorder",
  requireAuth,
  async (req, res, next) => {
    try {
      const elements = await reorderElements(
        req.uid!,
        req.params.pageId,
        req.body,
      );
      res.json(elements);
    } catch (error) {
      next(error);
    }
  },
);

pagesRouter.patch(
  "/:pageId/elements/:elementId",
  requireAuth,
  async (req, res, next) => {
    try {
      const element = await updateElement(
        req.uid!,
        req.params.pageId,
        req.params.elementId,
        req.body,
      );
      res.json(element);
    } catch (error) {
      next(error);
    }
  },
);
