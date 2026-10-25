import { useEffect, useRef } from 'react';

/**
 * Six-digit OTP input shared by the Profile forgot-password flow.
 * Keeps one accessible name per digit and supports paste/backspace movement.
 */
export default function OtpInput({ value, onChange, labelledBy = undefined }) {
  const refs = useRef([]);
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6).split('');
  while (digits.length < 6) digits.push('');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (index, digit) => {
    const next = [...digits];
    next[index] = digit;
    onChange(next.join(''));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  return (
    <div
      className="pw-otp"
      role="group"
      aria-label={labelledBy ? undefined : '6-digit verification code'}
      aria-labelledby={labelledBy}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => { refs.current[index] = element; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          aria-label={`Digit ${index + 1} of 6`}
          className="pw-otp-input"
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, '').slice(-1))}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (pasted.length > 1) {
              event.preventDefault();
              onChange(pasted.padEnd(6, '').slice(0, 6));
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
