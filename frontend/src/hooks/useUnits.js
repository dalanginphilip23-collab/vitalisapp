import { useEffect, useState } from 'react';
import { getUnits, UNITS_CHANGED_EVENT } from '../lib/units.js';

// Reactive Metric/Imperial preference. Re-reads the cached setting whenever
// Preferences saves (same-tab event) or another tab changes it (storage).
export function useUnits() {
  const [units, setUnits] = useState(() => getUnits());

  useEffect(() => {
    const refresh = () => setUnits(getUnits());
    window.addEventListener(UNITS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(UNITS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return units;
}

export default useUnits;
