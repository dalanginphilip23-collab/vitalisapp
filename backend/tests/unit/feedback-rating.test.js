// tests/unit/feedback-rating.test.js — star rating is required (1-5) and
// rides into the team email subject + body. Mailer is stubbed: no SMTP.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-min-32-chars-0123456789ab';
process.env.EMAIL_USER = process.env.EMAIL_USER || 'sender@test.io';
process.env.EMAIL_PASS = process.env.EMAIL_PASS || 'test-pass';
process.env.RECEIVER_EMAIL = process.env.RECEIVER_EMAIL || 'team@test.io';

let sent = [];
const mailerPath = require.resolve('../../src/config/mailer');
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    getTransporter: () => ({ sendMail: async (mail) => { sent.push(mail); return { ok: true }; } }),
    escapeHtml: (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  },
};

const feedback = require('../../src/controllers/feedback.controller');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const throwNext = (e) => { throw e; };
const base = { name: 'Ann', email: 'ann@test.io', message: 'Love the plans!' };

beforeEach(() => { sent = []; });

describe('feedback star rating', () => {
  it('accepts ratings 1-5 and puts stars in subject + body', async () => {
    const res = mockRes();
    await feedback.post({ body: { ...base, rating: 4 } }, res, throwNext);
    assert.equal(res.statusCode, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /★★★★☆ \(4\/5\)/);
    assert.ok(!sent[0].subject.includes('needs attention'));
    assert.match(sent[0].html, /★★★★☆/);
    assert.match(sent[0].html, /\(4\/5\)/);
    assert.match(sent[0].html, /<strong>Name:<\/strong> Ann/);
    assert.match(sent[0].html, /<strong>Email:<\/strong> ann@test.io/);
    assert.match(sent[0].html, /<strong>Message:<\/strong>/);
    assert.match(sent[0].text, /Name: Ann/);
    assert.match(sent[0].text, /Email: ann@test.io/);
    assert.match(sent[0].text, /Love the plans!/);
  });
  it('flags 1-2 star ratings as needing attention', async () => {
    const res = mockRes();
    await feedback.post({ body: { ...base, rating: 1 } }, res, throwNext);
    assert.equal(res.statusCode, 200);
    assert.match(sent[0].subject, /needs attention/);
    assert.match(sent[0].html, /needs attention/);
    assert.match(sent[0].text, /NEEDS ATTENTION/);
  });
  it('rejects missing, zero, six, and non-integer ratings', async () => {
    for (const rating of [undefined, 0, 6, 2.5, 'high']) {
      const res = mockRes();
      await feedback.post({ body: { ...base, rating } }, res, throwNext);
      assert.equal(res.statusCode, 400, `rating=${rating}`);
      assert.match(res.body.error, /rating/i);
    }
    assert.equal(sent.length, 0);
  });
  it('still rejects empty name/email/message with a valid rating', async () => {
    const res = mockRes();
    await feedback.post({ body: { ...base, name: '  ', rating: 5 } }, res, throwNext);
    assert.equal(res.statusCode, 400);
    assert.equal(sent.length, 0);
  });
});
