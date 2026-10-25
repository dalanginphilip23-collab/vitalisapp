import BiometricBar from "./BioMetricBar.jsx";
import Icon from "../../../../components/Icon.jsx";
export default function BiometricsCard({ biometrics }) {
  const metrics = [
    { label: 'Body Alignment', val: biometrics.alignment, color: 'var(--accent)' },
    { label: 'Rep Speed',      val: biometrics.velocity,  color: '#6AA9E8' },
    { label: 'Symmetry Index', val: biometrics.symmetry,  color: '#D08A6D' },
  ];
  const hasData = metrics.some((m) => Number.isFinite(m.val) && m.val > 0);
  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl border border-[var(--border-light)]">
      <h4 className="text-[var(--text-primary)] font-black text-[length:var(--fs-10)] mb-5 uppercase tracking-[0.3em] flex items-center gap-2">
        <Icon name="monitor_heart" className="text-[var(--accent)] text-sm" />
        Live Biometrics
        <span className="ml-1 rounded-full border border-[var(--border-light)] px-2 py-0.5 text-[length:var(--fs-9)] font-bold normal-case tracking-normal text-[var(--text-muted)]" title="Alignment and symmetry are estimated from pose landmarks; rep speed is not instrumented yet">
          Demo
        </span>
      </h4>
      <div className="space-y-5">
        {metrics.map((m) => (
          <BiometricBar key={m.label} label={m.label} val={m.val} color={m.color} />
        ))}
      </div>
      {!hasData && (
        <p className="mt-4 text-[length:var(--fs-11)] text-[var(--text-muted)]">
          Turn on the camera and press Start to track live metrics.
        </p>
      )}
    </div>
  );
}
