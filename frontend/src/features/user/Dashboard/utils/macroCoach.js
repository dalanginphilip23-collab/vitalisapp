// Macro Coach — pure insight over ACTUAL logged data vs goal targets.
// Lives in Nutrition (imported there) and feeds dashboard insights.
export const macroCoachMessage = (logged = {}, targets = {}) => {
  const kcal = Number(logged.kcal) || 0;
  const protein = Number(logged.protein) || 0;
  const tKcal = Number(targets.dailyKcal) || Number(targets.daily_kcal) || 0;
  const tProtein = Number(targets.proteinG) || Number(targets.protein_g) || 0;

  if (!tKcal) return 'Set your goal in onboarding to unlock Macro Coach targets.';
  if (kcal === 0) return 'No meals logged yet today. Log your first meal to start Macro Coach.';

  const proteinLeft = tProtein - protein;
  if (proteinLeft > 0 && kcal >= tKcal * 0.85) {
    return `You are approaching your calorie target but remain ${proteinLeft}g below protein. Add a protein-rich food to your next meal.`;
  }
  if (proteinLeft > 0) {
    return `You have ${proteinLeft}g of protein remaining today.`;
  }
  if (kcal > tKcal) {
    return `Over your ${tKcal.toLocaleString()} kcal target — tomorrow is a fresh start. Protein goal met.`;
  }
  return `On track: ${kcal.toLocaleString()} of ${tKcal.toLocaleString()} kcal, protein covered.`;
};
