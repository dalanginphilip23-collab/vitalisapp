require("./config/env");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { corsOptions, isAllowed } = require("./config/cors");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const mountRoutes = require("./routes");

let appVersion = "1.0.0";
try {
  appVersion = require("../package.json").version || "1.0.0";
} catch {
  appVersion = process.env.npm_package_version || "1.0.0";
}

function createApp(io) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-origin" },
      // API serves JSON: CSP guards HTML error pages / email link landings.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://accounts.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https://server.arcgisonline.com"],
          connectSrc: ["'self'", "https://accounts.google.com", "https://cdn.jsdelivr.net"],
          frameSrc: ["https://accounts.google.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      hsts: process.env.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(cors(corsOptions));
  app.use(cookieParser());

  // SameSite=None doesn't block cross-site writes: reject cross-origin
  // mutations whose Origin isn't allowlisted.
  app.use((req, res, next) => {
    try {
      const m = req.method;
      if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH' && m !== 'DELETE') return next();
      const origin = req.headers.origin;
      if (!origin) return next();
      if (isAllowed(origin)) return next();
      return res.status(403).json({ error: 'Forbidden origin', code: 'CSRF_BLOCKED' });
    } catch {
      return next();
    }
  });

  const json10mb = express.json({ limit: "10mb" });
  const json2mb = express.json({ limit: "2mb" });
  app.use("/api/food-logs/analyze-pic", json10mb);
  app.use("/api/analyze-pose", json10mb);
  app.use((req, res, next) => {
    const p = req.path || "";
    if (
      p.startsWith("/api/food-logs/analyze-pic") ||
      p.startsWith("/api/analyze-pose")
    )
      return next();
    return json2mb(req, res, next);
  });

  const GLOBAL_RATE_LIMIT = parseInt(process.env.GLOBAL_RATE_LIMIT, 10) || 1000;
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: GLOBAL_RATE_LIMIT,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests, please slow down." },
      skip: (req) =>
        req.path === "/api/auth/me" ||
        req.path === "/api/health" ||
        req.path === "/api/readyz" ||
        req.path === "/api/version" ||
        req.path === "/health",
    }),
  );

  if (io) app.set("io", io);

  app.use(requestLogger);
  app.get("/api/health", (req, res) =>
    res.json({ ok: true, time: new Date().toISOString() }),
  );
  app.get("/api/readyz", async (req, res) => {
    try {
      const db = require("./config/db");
      await Promise.race([
        db.query("SELECT 1"),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("db timeout")), 2000),
        ),
      ]);
      res.json({ ok: true, db: "up", time: new Date().toISOString() });
    } catch {
      res
        .status(503)
        .json({ ok: false, db: "down", time: new Date().toISOString() });
    }
  });
  app.get("/health", (req, res) => res.json({ ok: true }));
  app.get("/api/version", (req, res) => {
    res.json({
      ok: true,
      name: "vitalis-backend",
      version: appVersion,
      time: new Date().toISOString(),
    });
  });

  // All API routes
  mountRoutes(app);

  // 404 for unknown /api
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Not found", path: req.originalUrl }),
  );

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
