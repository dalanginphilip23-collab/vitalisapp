const ACTIVITY_FACTORS = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  HIGHLY_ACTIVE: 1.9,
};

/** Mifflin-St Jeor based plan engine: BMI/BMR/TDEE + macro split. Pure, no I/O. */

const PROTEIN_PER_KG = {
  LOSE_WEIGHT: 2.0,
  MAINTAIN_WEIGHT: 1.6,
  GAIN_WEIGHT: 1.8,
  BUILD_MUSCLE: 2.2,
  PERFORMANCE: 1.8,
};

function calcBmi(weightKg, heightCm) {
  const h = Number(heightCm) / 100;
  const w = Number(weightKg);
  if (!h || !w || h <= 0) return null;
  return Number((w / (h * h)).toFixed(1));
}

function bmiCategory(bmi) {
  if (bmi == null) return 'Unknown';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy range';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function calcBmr({ weightKg, heightCm, age, sex }) {
  const w = Number(weightKg),
    h = Number(heightCm),
    a = Number(age);
  if (!w || !h || !a) return null;
  const male = Math.round(10 * w + 6.25 * h - 5 * a + 5);
  const female = Math.round(10 * w + 6.25 * h - 5 * a - 161);
  if (sex === 'male') return male;
  if (sex === 'female') return female;
  return Math.round((male + female) / 2);
}

/**
 * Build a nutrition plan (BMI/BMR/TDEE + macro split) from raw profile input.
 * @param {{ weightKg?: number | string | null, heightCm?: number | string | null, dob?: string | number | Date | null, sex?: string | null, activityLevel?: string | null, goalType?: string | null, pace?: string | null }} [input]
 * @returns {{ bmi: number | null, bmiCategory: string, age: number | null, bmr: number | null, tdee: number | null, dailyKcal: number | null, proteinG: number | null, carbsG: number | null, fatG: number | null }}
 */
function generatePlan(input = {}) {
  const { weightKg, heightCm, dob, sex, activityLevel, goalType, pace } = input;
  const bmi = calcBmi(weightKg, heightCm);
  const age = ageFromDob(dob);
  const bmr = calcBmr({ weightKg, heightCm, age, sex });
  const factor = ACTIVITY_FACTORS[activityLevel] || 1.2;
  const tdee = bmr ? Math.round(bmr * factor) : null;

  let dailyKcal = tdee;
  if (tdee) {
    // Pace-aware deltas cover the full validated enum (PACES in
    // goals.service: SLOW, GRADUAL, MODERATE, FASTER, AGGRESSIVE). Unknown or
    // missing pace keeps the historical default (LOSE → -500 via MODERATE,
    // GAIN → +250 via GRADUAL — a small, safe surplus). GAIN never exceeds
    // +400 — aggressive bulking is deliberately not offered; the 1200/1500
    // kcal floor guards deep deficits.
    const KCAL_DELTA_BY_PACE = {
      LOSE_WEIGHT: { SLOW: -250, GRADUAL: -300, MODERATE: -500, FASTER: -750, AGGRESSIVE: -750, DEFAULT: -500 },
      GAIN_WEIGHT: { SLOW: 125, GRADUAL: 250, MODERATE: 400, FASTER: 250, AGGRESSIVE: 400, DEFAULT: 250 },
    };
    const p = (pace || '').toUpperCase();
    if (goalType === 'LOSE_WEIGHT' || goalType === 'GAIN_WEIGHT') {
      const deltas = KCAL_DELTA_BY_PACE[goalType];
      dailyKcal = tdee + (deltas[p] ?? deltas.DEFAULT);
    } else if (goalType === 'BUILD_MUSCLE') {
      dailyKcal = tdee + 200;
    } else if (goalType === 'PERFORMANCE') {
      dailyKcal = tdee + 100;
    } else {
      dailyKcal = tdee; // MAINTAIN_WEIGHT
    }
    const floor = sex === 'female' ? 1200 : 1500;
    dailyKcal = Math.max(dailyKcal, floor);
  }

  let proteinG = null,
    carbsG = null,
    fatG = null;
  if (dailyKcal && weightKg) {
    proteinG = Math.round((PROTEIN_PER_KG[goalType] || 1.6) * Number(weightKg));
    fatG = Math.round((dailyKcal * 0.25) / 9);
    carbsG = Math.max(0, Math.round((dailyKcal - proteinG * 4 - fatG * 9) / 4));
  }

  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    age,
    bmr,
    tdee,
    dailyKcal,
    proteinG,
    carbsG,
    fatG,
  };
}

module.exports = {
  ACTIVITY_FACTORS,
  calcBmi,
  bmiCategory,
  ageFromDob,
  calcBmr,
  generatePlan,
};
