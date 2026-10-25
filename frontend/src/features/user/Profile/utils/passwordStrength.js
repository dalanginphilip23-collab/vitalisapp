// Existing password-strength heuristic, extracted so the change-password and
// forgot-password forms stay visually and behaviorally identical.
// This is presentation guidance only — the server rule is still "min 8 chars".
export function getPasswordStrength(password) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) {
    return { key: 'weak', label: 'Weak', bars: 1 };
  }
  if (score <= 3) {
    return { key: 'medium', label: 'Medium', bars: score };
  }
  return { key: 'strong', label: 'Strong', bars: 4 };
}
