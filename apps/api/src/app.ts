import express from "express";

import { cors } from "./middleware/cors.js";
import { authenticate } from "./middleware/authenticate.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { invitesRouter } from "./routes/invites.js";
import { pagesRouter } from "./routes/pages.js";

export function createApp() {
  const app = express();

  app.use(cors);
  app.use(express.json());
  app.use(authenticate);

  const api = express.Router();
  api.use(healthRouter);
  api.use("/invites", invitesRouter);
  api.use("/pages", pagesRouter);
  app.use("/api", api);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
