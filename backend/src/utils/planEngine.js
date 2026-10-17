const { KCAL } = require('../constants/thresholds');

const ACTIVITY_FACTORS = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  HIGHLY_ACTIVE: 1.9,
};

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

function generatePlan(input = {}) {
  const { weightKg, heightCm, dob, sex, activityLevel, goalType, pace } = input;
  const bmi = calcBmi(weightKg, heightCm);
  const age = ageFromDob(dob);
  const bmr = calcBmr({ weightKg, heightCm, age, sex });
  const factor = ACTIVITY_FACTORS[activityLevel] || 1.2;
  const tdee = bmr ? Math.round(bmr * factor) : null;

  let dailyKcal = tdee;
  if (tdee) {
    const p = (pace || '').toUpperCase();
    switch (goalType) {
      case 'LOSE_WEIGHT':
        dailyKcal =
          tdee -
          (p === 'GRADUAL'
            ? KCAL.LOSE_GRADUAL
            : p === 'FASTER'
              ? KCAL.LOSE_FASTER
              : KCAL.LOSE_DEFAULT);
        break;
      case 'GAIN_WEIGHT':
        dailyKcal = tdee + (p === 'MODERATE' ? KCAL.GAIN_MODERATE : KCAL.GAIN_DEFAULT);
        break;
      case 'BUILD_MUSCLE':
        dailyKcal = tdee + KCAL.MUSCLE_SURPLUS;
        break;
      case 'PERFORMANCE':
        dailyKcal = tdee + KCAL.PERFORMANCE_SURPLUS;
        break;
      default:
        dailyKcal = tdee; // MAINTAIN_WEIGHT
    }
    const floor = sex === 'female' ? KCAL.FLOOR_FEMALE : KCAL.FLOOR_MALE;
    dailyKcal = Math.max(dailyKcal, floor);
  }

  let proteinG = null,
    carbsG = null,
    fatG = null;
  if (dailyKcal && weightKg) {
    proteinG = Math.round((PROTEIN_PER_KG[goalType] || 1.6) * Number(weightKg));
    fatG = Math.round((dailyKcal * KCAL.FAT_RATIO) / KCAL.KCAL_PER_G_FAT);
    carbsG = Math.max(
      0,
      Math.round((dailyKcal - proteinG * 4 - fatG * 9) / KCAL.KCAL_PER_G_PROTEIN_CARB)
    );
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
