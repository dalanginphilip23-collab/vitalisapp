const env = require("./src/config/env");
const http = require("http");
const { Server } = require("socket.io");
const { corsOptions } = require("./src/config/cors");
const createApp = require("./src/app");

const PORT = env.port || process.env.PORT || 3000;

const app = createApp();
const server = http.createServer(app);
const socketOrigin = (origin, cb) => {
  if (!origin) return cb(null, true);
  corsOptions.origin(origin, (err, ok) => {
    if (err) return cb(err, false);
    if (!ok && process.env.NODE_ENV !== "production") {
      console.warn("[socket] CORS blocked origin:", origin);
    }
    return cb(null, Boolean(ok));
  });
};
const io = new Server(server, {
  cors: {
    origin: socketOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});
app.set("io", io);

// Socket.IO handler — src/sockets
try {
  require("./src/sockets/socketHandler")(io);
} catch (e) {
  console.warn("[socket] handler not loaded:", e.message);
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} already in use.`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`   taskkill /PID <pid> /F`);
    console.error(`   Or change PORT in backend/.env`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`✅ Vitalis Backend Engine Running on Port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `   Routes: http://localhost:${PORT}/api/_routes  | Health: /api/health`,
    );
  } else {
    console.log(`   Health: /api/health`);
  }
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Fix the promise above — dev continues so you can see it, prod exits.");
  console.error(reason);
  if (process.env.NODE_ENV === "production") process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Fix the throw above — dev continues so you can see it, prod exits.");
  console.error(err);
  if (process.env.NODE_ENV === "production") process.exit(1);
});

module.exports = { app, server, io };
