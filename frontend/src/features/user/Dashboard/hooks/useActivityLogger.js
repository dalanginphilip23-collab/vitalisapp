import { apiGet, apiPost } from '../../../../lib/apiClient.js';
import { useToastStore } from '../../../../stores/toastStore.js';
import { localTodayIso } from '../lib/dashboardFormat.js';

export const useActivityLogger = (
  USER_ID,
  { setData, setBiometrics, biometrics, generateAiInsight = undefined, generateFitnessInsight, generateClinicalInsight = undefined, mergeData }
) => {
  const generateInsight = generateAiInsight || generateFitnessInsight || generateClinicalInsight;

  const handleLogActivity = async (formData = {}) => {
    try {
      const calories = formData.calories ? parseInt(formData.calories) : 0;
      const steps    = formData.steps    ? parseInt(formData.steps)    : 0;
      const minutes  = formData.minutes  ? parseInt(formData.minutes)  : 0;
      const waterMl  = formData.water    ? parseInt(formData.water)    : 0;

      const hasActivity = calories > 0 || steps > 0 || minutes > 0;

      if (hasActivity) {
        await apiPost(`/api/logs/${USER_ID}`, { calories, steps, minutes });
      }

      // Water is stored with the sleep/recovery log (sleep_logs.water_intake_ml),
      // not daily_stats — previously this field was silently dropped.
      if (waterMl > 0) {
        await apiPost(`/api/sleep/${USER_ID}`, { water_intake_ml: waterMl });
      }

      if (!hasActivity && !(waterMl > 0)) return;

      const [updatedData, freshBiometrics] = await Promise.all([
        apiGet(`/api/dashboard/${USER_ID}?today=${localTodayIso()}`),
        apiGet(`/api/sleep/${USER_ID}?range=D&metric=duration`).catch(() => []),
      ]);

      const latestSleep = await apiGet(`/api/sleep/${USER_ID}/today`).catch(() => null);

      const newStats = {
        ...updatedData.stats,
        water_intake_ml: latestSleep?.water_intake_ml || 0,
        sleep_duration:  latestSleep?.sleep_duration  || 0,
        sleep_quality:   latestSleep?.sleep_quality   || 0,
      };

      // mergeData 
      setData(mergeData({
        ...updatedData,
        stats: newStats,
      }));

      if (Array.isArray(freshBiometrics)) {
        setBiometrics(freshBiometrics);
      }

      if (typeof generateInsight === 'function') {
        generateInsight(
          Array.isArray(freshBiometrics) ? freshBiometrics : biometrics,
          newStats
        );
      }

    } catch (error) {
      useToastStore.getState().addToast('Could not log activity. Please try again.', 'error');
      if (import.meta.env.DEV) console.error('Error logging activity:', error);
    }
  };

  return { handleLogActivity };
};