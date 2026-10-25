const jwt = require("jsonwebtoken");
const { COOKIE_NAME } = require("../utils/cookies");

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    let v = raw;
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
          "SELECT token_version FROM users WHERE id = ? LIMIT 1",
          [authedUserId]
        );
        const row = rows[0];
        if (!row || Number(row.token_version || 0) !== Number(session.tv || 0)) {
          socket.emit("session_revoked", { error: "Session revoked. Please sign in again." });
          try { socket.disconnect(true); } catch { /* noop */ }
          return;
        }
        // Note: verification is soft (Option A) — unverified sessions keep
        // their live room; the in-app banner handles the reminder.
      } catch {
        // DB blip on connect — allow join, periodic reverify will enforce.
      }
      try {
        socket.join(authedUserId);
        socket.data.userId = authedUserId;
        socket.data.tv = session.tv;
        socket.data.joinedRoom = authedUserId;
        if (process.env.NODE_ENV !== "production") {
          console.log(`[socket] ${socket.id} auto-joined room ${authedUserId}`);
        }
      } catch (e) {
        console.warn("[socket] join failed:", e.message);
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
          console.log(`[socket] ${socket.id} joined room ${verified}`);
        }
      } catch (e) {
        console.warn("[socket] join-room failed:", e.message);
      }
    });

    // Live chat relay. The client persists the message over REST first, then
    // emits `send-chat` with the saved row id. We re-read the row from the DB
    // (never trust client-supplied content) and fan it out to the recipient's
    // room as `receive-chat` — this is what makes messages appear instantly.
    socket.on("send-chat", async (payload) => {
      try {
        const me = socket.data.userId;
        if (!me) return;
        const id = Number(payload?.id);
        if (!Number.isInteger(id) || id <= 0) return;

        const db = require("../config/db");
        const [rows] = await db.execute(
          `SELECT id, sender_id, receiver_id, content,
                  DATE_FORMAT(sent_at, '%H:%i') as time
           FROM messages WHERE id = ? LIMIT 1`,
          [id],
        );
        const row = rows[0];
        if (!row) return;
        // A socket may only relay messages it actually sent.
        if (String(row.sender_id) !== String(me)) return;

        io.to(String(row.receiver_id)).emit("receive-chat", {
          id: row.id,
          sender_id: row.sender_id,
          receiver_id: row.receiver_id,
          content: row.content,
          time: row.time,
          isMe: 0,
        });
      } catch (e) {
        console.warn("[socket] send-chat failed:", e.message);
      }
    });

    socket.on("disconnect", () => {
      clearInterval(reverifyTimer);
    });
  });
};
