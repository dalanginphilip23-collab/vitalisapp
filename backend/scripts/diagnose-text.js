// One-off diagnostic: text AI chain (Gemini text models + Groq fallback).
require('../src/config/env');
const { callGeminiWithFallback, suggestPlanForMeal, getGroq } = require('../src/config/gemini');

(async () => {
  console.log('[diag-text] models:', process.env.GEMINI_TEXT_MODELS || '(defaults)');

  const t0 = Date.now();
  try {
    const out = await callGeminiWithFallback('Reply with exactly: PING OK');
    console.log(`[diag-text] text chain OK (${((Date.now() - t0) / 1000).toFixed(1)}s):`, String(out).slice(0, 120));
  } catch (e) {
    console.error('[diag-text] TEXT CHAIN FAILED:', e.message);
  }

  // Direct Groq probe — isolates the fallback provider alone.
  try {
    const g = await getGroq().chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: 'Reply with exactly: PONG' }],
      max_tokens: 10,
    });
    console.log('[diag-text] groq OK:', g.choices?.[0]?.message?.content?.slice(0, 40));
  } catch (e) {
    console.error('[diag-text] GROQ FAILED:', e.status || '', e.message);
  }

  // The actual suggest-plan prompt shape used by the meal tracker coach.
  try {
    const plan = await suggestPlanForMeal(
      { food_name: 'chicken rice', calories: 500, protein: 35, carbs: 50, fat: 12 },
      [{ id: 1, title: 'Beginner Bulk', tag: 'BUILD_MUSCLE', intensity: 'moderate' }],
      { caloriesSoFar: 1200, calorieTarget: 2320 },
    );
    console.log('[diag-text] suggestPlan OK:', JSON.stringify(plan).slice(0, 150));
  } catch (e) {
    console.error('[diag-text] suggestPlanForMeal FAILED:', e.message);
  }
})();
