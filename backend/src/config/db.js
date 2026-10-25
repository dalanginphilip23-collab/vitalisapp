try { require('dotenv').config(); } catch {}
const mysql = require('mysql2');

if (!process.env.DB_NAME) {
  throw new Error('[db] DB_NAME is not set — load src/config/env first or set backend/.env');
}

// ─── Managed-MySQL TLS (Aiven etc.) ───
// NODE_ENV=production, or an Aiven DB_HOST, turns TLS on automatically
// (DB_SSL=1 forces it on anywhere; DB_SSL=0 forces it off). The CA comes from
// DB_SSL_CA — a path to ca.pem, or the raw PEM pasted inline, which is how
// deploy platforms inject secrets (set DB_SSL_CA to the ca.pem contents).
const host = process.env.DB_HOST || '127.0.0.1';
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const isAivenHost = /\.aivencloud\.com$|\.aiven\.io$/i.test(host.trim());
const sslFlag = String(process.env.DB_SSL || '').toLowerCase();

const useSsl =
  sslFlag === '1' || sslFlag === 'true'
    ? true
    : sslFlag === '0' || sslFlag === 'false'
      ? false
      : isProduction || isAivenHost;

let sslOpt;
if (useSsl) {
  const fs = require('fs');
  const caRef = process.env.DB_SSL_CA || '';
  let ca = undefined;
  try {
    if (caRef && fs.existsSync(caRef)) ca = fs.readFileSync(caRef, 'utf8');
    else if (caRef && caRef.includes('BEGIN CERTIFICATE')) ca = caRef.replace(/\\n/g, '\n');
  } catch { /* fall through to default secure */
  }

  if (!ca && (isProduction || isAivenHost) && sslFlag !== '0' && sslFlag !== 'false') {
    // Fail fast: Aiven rejects unverified TLS, so a missing CA would only
    // surface later as a cryptic handshake error on the first query.
    throw new Error(
      '[db] TLS is required (NODE_ENV=production / Aiven host) but DB_SSL_CA is not set — ' +
      'add the DB_SSL_CA secret with the contents (or path) of your provider ca.pem.',
    );
  }
  if (!ca) {
    console.warn('[db] DB_SSL=1 without DB_SSL_CA — set it to your provider ca.pem if connects fail');
  }
  sslOpt = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
}

const pool = mysql.createPool({
  host,
  user: process.env.DB_USER || 'root',
  // XAMPP root often has an empty password — mysql2 needs undefined, not ''.
  password: process.env.DB_PASS ? process.env.DB_PASS : undefined,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  ...(sslOpt ? { ssl: sslOpt } : {}),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_MAX, 10) || 25,
  // Bounded queue fails fast under burst instead of growing memory unbounded.
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10) || 200,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
});

// Idle-connection errors must never crash the server.
pool.on('error', (err) => {
  console.error('[db] pool error:', err.code || err.message);
});

module.exports = pool.promise();
