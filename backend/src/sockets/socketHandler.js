const jwt = require("jsonwebtoken");
const { COOKIE_NAME } = require("../utils/cookies");
const log = require("../utils/logger");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    let v;
    try {
      v = decodeURIComponent(raw);
    } catch (_) {
      v = raw;
    }
    if (k) out[k] = v;
  }
  return out;
}

function getSessionFromSocket(socket) {
  const cookies = parseCookies(socket.handshake.headers?.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const { verifySession } = require("../config/jwt");
    const decoded = verifySession(jwt, token);
    if (!decoded?.id) return null;
    return { id: String(decoded.id), tv: Number(decoded.tv || 0) };
  } catch {
    return null;
  }
}

function getUserIdFromSocket(socket) {
  return getSessionFromSocket(socket)?.id ?? null;
}

module.exports = (io) => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "[socket] JWT_SECRET is not set — refusing to start unauthenticated sockets",
    );
  }
  // Periodic token_version check evicts sockets revoked by logout/password change.
  // Clamped 10s..10min so a bad env can't hot-loop or disable enforcement.
  const _rawReverify = parseInt(process.env.SOCKET_REVERIFY_MS, 10);
  const REVERIFY_MS = Number.isFinite(_rawReverify)
    ? Math.min(Math.max(_rawReverify, 10 * 1000), 10 * 60 * 1000)
    : 90 * 1000;

  io.on("connection", (socket) => {
    const session = getSessionFromSocket(socket);
    const authedUserId = session?.id ?? null;
    if (!authedUserId) {
      socket.emit("unauthorized", { error: "Not authenticated" });
      socket.disconnect(true);
      return;
    }
    // Immediate DB verification on connect (not only after 90s): revoked or
    // unverified sessions are rejected at once instead of getting a live room.
    (async () => {
      try {
        const db = require("../config/db");
        const [rows] = await db.execute(
          "SELECT token_version, is_verified FROM users WHERE id = ? LIMIT 1",
          [authedUserId]
        );
        const row = rows[0];
        if (!row || Number(row.token_version || 0) !== Number(session.tv || 0)) {
          socket.emit("session_revoked", { error: "Session revoked. Please sign in again." });
          try { socket.disconnect(true); } catch { /* noop */ }
          return;
        }
        if (Number(row.is_verified) !== 1) {
          socket.emit("unauthorized", { error: "Email not verified" });
          try { socket.disconnect(true); } catch { /* noop */ }
          return;
        }
      } catch {
        // DB blip on connect — allow join, periodic reverify will enforce.
      }
      try {
        socket.join(authedUserId);
        socket.data.userId = authedUserId;
        socket.data.tv = session.tv;
        socket.data.joinedRoom = authedUserId;
        if (process.env.NODE_ENV !== "production") {
          log.debug(`[socket] ${socket.id} auto-joined room ${authedUserId}`);
        }
      } catch (e) {
        log.warn("[socket] join failed:", e.message);
      }
    })();

    const reverifyTimer = setInterval(async () => {
      try {
        if (!socket.connected) return;
        const db = require("../config/db");
        const [rows] = await db.execute(
          "SELECT token_version FROM users WHERE id = ? LIMIT 1",
          [socket.data.userId]
        );
        const current = rows[0] ? Number(rows[0].token_version || 0) : null;
        if (current === null || current !== Number(socket.data.tv || 0)) {
          socket.emit("session_revoked", { error: "Session revoked. Please sign in again." });
          socket.disconnect(true);
        }
      } catch {
        // DB blip — try again next round.
      }
    }, REVERIFY_MS);
    if (reverifyTimer.unref) reverifyTimer.unref();

    socket.on("join-room", (requestedUserId) => {
      try {
        // Fresh cookie decode each time (also refreshes tv after re-login).
        const fresh = getSessionFromSocket(socket);
        const verified = fresh?.id || socket.data.userId;
        if (fresh) socket.data.tv = fresh.tv;
        if (!verified) {
          socket.emit("unauthorized", { message: "Not authenticated" });
          return;
        }
        if (requestedUserId && String(requestedUserId) !== String(verified)) {
          socket.emit("forbidden", {
            message: "Cannot join another user room",
          });
          return;
        }
        // Re-joining the same room is a no-op in socket.io — stay silent so
        // one connection doesn't log "joined room 13" per mounted screen.
        if (socket.data.joinedRoom === String(verified)) return;
        socket.join(String(verified));
        socket.data.userId = String(verified);
        socket.data.joinedRoom = String(verified);
        if (process.env.NODE_ENV !== "production") {
          log.debug(`[socket] ${socket.id} joined room ${verified}`);
        }
      } catch (e) {
        log.warn("[socket] join-room failed:", e.message);
      }
    });

    // Relay-only chat: the client persists via POST /api/messages first, then
    // emits the saved row here for instant delivery. This handler NEVER
    // writes to the DB — it only validates and forwards to the receiver's
    // room. Friends-only: strangers can't push into anyone's room.
    const CHAT_WINDOW_MS = 60 * 1000;
    const CHAT_MAX_PER_WINDOW = 30; // matches REST messages limiter
    socket.on("send-chat", async (payload) => {
      try {
        const senderId = socket.data.userId || getUserIdFromSocket(socket);
        if (!senderId) {
          socket.emit("unauthorized", { message: "Not authenticated" });
          return;
        }
        const body = payload && typeof payload === "object" ? payload : {};
        const msgSenderId = body.sender_id != null ? String(body.sender_id) : "";
        const receiverId = body.receiver_id != null ? String(body.receiver_id) : "";
        const content = typeof body.content === "string" ? body.content.trim() : "";
        // Sender must be self (no impersonation), ids numeric, content bounded
        // exactly like POST /api/messages (2000 chars).
        if (
          !/^\d+$/.test(msgSenderId) ||
          !/^\d+$/.test(receiverId) ||
          msgSenderId !== String(senderId) ||
          content.length === 0 ||
          content.length > 2000
        ) {
          socket.emit("forbidden", { message: "Invalid chat payload" });
          return;
        }
        // Per-socket rate limit (socket events bypass HTTP limiters).
        const now = Date.now();
        const stamps = Array.isArray(socket.data.chatStamps) ? socket.data.chatStamps : [];
        const fresh = stamps.filter((t) => now - t < CHAT_WINDOW_MS);
        if (fresh.length >= CHAT_MAX_PER_WINDOW) {
          socket.emit("rate-limited", { message: "Too many messages. Slow down." });
          return;
        }
        fresh.push(now);
        socket.data.chatStamps = fresh;
        // Friends-only: accepted or close_friend in either direction.
        const db = require("../config/db");
        const [friends] = await db.execute(
          `SELECT 1 FROM friendships
           WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
             AND status IN ('accepted', 'close_friend') LIMIT 1`,
          [senderId, receiverId, receiverId, senderId]
        );
        if (!friends[0]) {
          socket.emit("forbidden", { message: "Can only message friends" });
          return;
        }
        // Forward a whitelisted shape — never blind-spread client payloads.
        io.to(String(receiverId)).emit("receive-chat", {
          id: body.id ?? null,
          sender_id: Number(msgSenderId),
          receiver_id: Number(receiverId),
          content,
          time: typeof body.time === "string" ? body.time.slice(0, 16) : undefined,
        });
      } catch (e) {
        log.warn("[socket] send-chat failed:", e.message);
      }
    });

    socket.on("disconnect", () => {
      clearInterval(reverifyTimer);
    });
  });
};
