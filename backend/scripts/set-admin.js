#!/usr/bin/env node
// scripts/set-admin.js — Module 1 admin role utility.
// Usage:
//   node scripts/set-admin.js <email>            promote to admin
//   node scripts/set-admin.js <email> member     demote back to member
// Requires migration 036 (users.role) and backend/.env DB credentials.
require('dotenv').config();
const db = require('../src/config/db');

(async () => {
  const [emailRaw, roleArg] = process.argv.slice(2);
  const email = String(emailRaw || '').trim().toLowerCase();
  const role = roleArg === 'member' || roleArg === 'd' ? 'member' : 'admin';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: node scripts/set-admin.js <email> [admin|member]');
    process.exit(1);
  }
  try {
    const [rows] = await db.execute('SELECT id, name, role FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      console.error(`No user with email ${email} — the account must exist first`);
      process.exit(1);
    }
    const u = rows[0];
    if (u.role === role) {
      console.log(`${email} is already ${role} (nothing to do)`);
    } else {
      await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, u.id]);
      console.log(`✔ ${email} (${u.name}) is now ${role}`);
    }
    if (role === 'admin' && !(process.env.ADMIN_EMAILS || '').toLowerCase().includes(email)) {
      console.log('t tip: add this email to ADMIN_EMAILS in backend/.env so re-registering keeps admin rights');
    }
    await db.end();
  } catch (e) {
    console.error('set-admin failed:', e.message);
    process.exit(1);
  }
})();
