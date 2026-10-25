const { callGeminiWithFallback } = require('../config/gemini');

const SERVER_SYSTEM = 'You are a terse, encouraging personal trainer. Reply with ONE coaching cue of 12 words or fewer. No quotes, no trailing punctuation.';

// Build the coaching prompt, call the AI, and guard the overload fallback.
// Returns { text, degraded } — identical shape to the old controller response.
async function getCoachingCue(workoutType, context) {
  const fullPrompt = `${SERVER_SYSTEM}\n\nExercise: ${workoutType.toUpperCase()}\n${context}`;
  const raw = await callGeminiWithFallback(fullPrompt);
  const text = String(raw ?? '').trim();
  // Never speak the overload fallback as a coaching cue
  if (/high demand|currently experiencing|try again later/i.test(text)) {
    return { text: 'Hold form, breathe steady, keep going.', degraded: true };
  }
  return { text, degraded: false };
}

module.exports = { SERVER_SYSTEM, getCoachingCue };
