// tests/integration/auth-flows.test.js — regression coverage for the two
// crypto-dependent auth paths: GET /verify-email (sha256 token hashing) and
// POST /google-login (crypto.randomBytes → random bcrypt password for new
// users). db, session and googleAuth are stubbed via require.cache, matching
// the socket-relay technique.
// Background: refactor 6310387 dropped `const crypto = require('crypto')`
// from auth.controller.js; on Node >=19 the bare `crypto` global resolves to
// Web Crypto (no createHash/randomBytes), breaking both flows with a
// TypeError that shipped because no test exercised them.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-min-32-chars-0123456789ab';

let __sql = [];
let __userByEmail = [];
let __verifyRows = [];
const __newUserRow = {
  id: 42, name: 'G User', email: 'guser@example.com',
  fitness_goal: 'Unspecified (Google Auth)', avatar_url: null,
  is_verified: 1, onboarding_completed: 0, token_version: 0,
};

const dbPath = require.resolve('../../src/config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    execute: async (sql, params = []) => {
      __sql.push({ sql: String(sql), params });
      if (/SELECT id, user_id FROM email_verifications/i.test(sql)) return [__verifyRows];
      if (/FROM users WHERE email/i.test(sql)) return [__userByEmail];
      if (/INSERT INTO users /i.test(sql)) return [{ insertId: 42 }];
      if (/FROM users WHERE id =/i.test(sql)) return [[__newUserRow]];
      if (/FROM user_profiles/i.test(sql)) return [[]];
      return [[]];
    },
    query: async () => [[]],
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: async () => [[]],
    }),
  },
};

const sessionPath = require.resolve('../../src/services/session');
require.cache[sessionPath] = {
  id: sessionPath,
  filename: sessionPath,
  loaded: true,
  exports: { setSessionCookie: () => {}, logUserSession: async () => {} },
};

const gaPath = require.resolve('../../src/services/googleAuth');
require.cache[gaPath] = {
  id: gaPath,
  filename: gaPath,
  loaded: true,
  exports: {
    googleClient: {
      getToken: async () => ({ tokens: { id_token: 'fake-id-token' } }),
      verifyIdToken: async () => ({
        getPayload: () => ({ email: 'guser@example.com', name: 'G User', picture: 'https://example.com/p.png' }),
      }),
    },
  },
};

const controller = require('../../src/controllers/auth.controller');

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const failNext = (e) => { throw e; };
const googleReq = (code = 'oauth-code') => ({ body: { code }, headers: { 'user-agent': 'test' }, socket: {} });

describe('GET /api/auth/verify-email (crypto hashing)', () => {
  beforeEach(() => { __sql = []; __verifyRows = []; });

  it('rejects a missing token with 400', async () => {
    const res = mockRes();
    await controller.getverifyEmail({ query: {} }, res, failNext);
    assert.equal(res.statusCode, 400);
  });

  it('looks the token up by sha256 hash and marks the account verified', async () => {
    __verifyRows = [{ id: 9, user_id: 42 }];
    const token = 'a'.repeat(64);
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
    const res = mockRes();
    await controller.getverifyEmail({ query: { token } }, res, failNext);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const lookup = __sql.find((c) => /SELECT id, user_id FROM email_verifications/i.test(c.sql));
    assert.ok(lookup, 'token lookup ran');
    assert.equal(lookup.params[0], expectedHash, 'token is looked up by its sha256 hash');
    assert.ok(__sql.some((c) => /UPDATE email_verifications SET used = 1/i.test(c.sql)), 'token marked used');
    assert.ok(__sql.some((c) => /UPDATE users SET is_verified = 1/i.test(c.sql)), 'user marked verified');
  });

  it('returns 400 for unknown or expired tokens without touching the user', async () => {
    __verifyRows = [];
    const res = mockRes();
    await controller.getverifyEmail({ query: { token: 'deadbeef' } }, res, failNext);
    assert.equal(res.statusCode, 400);
    assert.ok(!__sql.some((c) => /UPDATE users SET is_verified/i.test(c.sql)));
  });
});

describe('POST /api/auth/google-login (crypto.randomBytes)', () => {
  beforeEach(() => { __sql = []; __userByEmail = []; });

  it('rejects a missing authorization code with 400', async () => {
    const res = mockRes();
    await controller.postgoogleLogin({ body: {}, headers: {}, socket: {} }, res, failNext);
    assert.equal(res.statusCode, 400);
  });

  it('creates a new user with a bcrypt-hashed random password', async () => {
    __userByEmail = [];
    const res = mockRes();
    await controller.postgoogleLogin(googleReq(), res, failNext);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.isVerified, true);
    const insert = __sql.find((c) => /INSERT INTO users /i.test(c.sql));
    assert.ok(insert, 'user insert ran');
    const hashedPw = insert.params[2];
    assert.match(String(hashedPw), /^\$2/, 'password column holds a bcrypt hash');
  });

  it('generates a different random password per signup', async () => {
    const run = async () => {
      __userByEmail = [];
      __sql = [];
      await controller.postgoogleLogin(googleReq(), mockRes(), failNext);
      return __sql.find((c) => /INSERT INTO users /i.test(c.sql)).params[2];
    };
    const first = await run();
    const second = await run();
    assert.notEqual(first, second, 'random password input must differ per signup');
  });

  it('marks an existing Google user verified and online', async () => {
    __userByEmail = [{
      id: 7, name: 'Old', email: 'guser@example.com', password: 'x',
      fitness_goal: 'general', avatar_url: null, is_verified: 0,
      onboarding_completed: 1, token_version: 2,
    }];
    const res = mockRes();
    await controller.postgoogleLogin(googleReq(), res, failNext);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.isVerified, true);
    assert.ok(__sql.some((c) => /UPDATE users SET is_online = 1, is_verified = 1/i.test(c.sql)));
    assert.ok(!__sql.some((c) => /INSERT INTO users /i.test(c.sql)), 'no duplicate user created');
  });
});
