import React from 'react';

const RunAnalysisOverlay = ({ analysis, onClose }) => {
  if (!analysis) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md my-auto bg-[var(--bg-tertiary)] border border-[var(--border-medium)] rounded-3xl overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="bg-[var(--accent-bg)] px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{analysis.emoji_verdict || '🏃'}</span>
            <div className="min-w-0">
              <p className="text-[length:var(--fs-11)] font-black uppercase tracking-widest text-[var(--accent)]">AI Run Analysis</p>
              <p className="text-[length:var(--fs-10)] text-[var(--text-muted)]">Powered by Vitalis AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close analysis"
            className="w-11 h-11 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center border-none cursor-pointer transition-colors shrink-0"
          >
            <span className="text-[var(--text-muted)] text-sm">✕</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-3 border-b border-[var(--border-light)] shrink-0">
          <div className="text-center min-w-0">
            <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-13)] font-black text-[var(--text-primary)] truncate">{analysis.stats?.distance || '0'}</p>
            <p className="text-[length:var(--fs-8)] uppercase tracking-widest text-[var(--text-muted)] font-bold">Distance</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-13)] font-black text-[var(--text-primary)] truncate">{analysis.stats?.duration || '0:00'}</p>
            <p className="text-[length:var(--fs-8)] uppercase tracking-widest text-[var(--text-muted)] font-bold">Time</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-13)] font-black text-[var(--text-primary)] truncate">{analysis.stats?.pace || '0:00'}</p>
            <p className="text-[length:var(--fs-8)] uppercase tracking-widest text-[var(--text-muted)] font-bold">Pace</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[length:var(--fs-11)] sm:text-[length:var(--fs-13)] font-black text-[var(--text-primary)] truncate">{analysis.stats?.calories || '0'}</p>
            <p className="text-[length:var(--fs-8)] uppercase tracking-widest text-[var(--text-muted)] font-bold">Calories</p>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--accent)]/60 mb-1.5">Run Summary</p>
            <p className="text-[length:var(--fs-12)] sm:text-[length:var(--fs-13)] text-[var(--text-secondary)] leading-relaxed break-words">{analysis.summary || 'Great run! Keep up the good work.'}</p>
          </div>
          <div className="bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-2xl px-4 py-3">
            <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--accent)] mb-1.5">🔮 30-Day Prediction</p>
            <p className="text-[length:var(--fs-12)] sm:text-[length:var(--fs-13)] text-[var(--text-secondary)] leading-relaxed break-words">{analysis.prediction || 'Consistency will lead to significant improvements.'}</p>
          </div>
          <div className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-2xl px-4 py-3">
            <p className="text-[length:var(--fs-9)] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">💡 Next Run Tip</p>
            <p className="text-[length:var(--fs-12)] sm:text-[length:var(--fs-13)] text-[var(--text-secondary)] leading-relaxed break-words">{analysis.tip || 'Focus on maintaining a steady pace throughout.'}</p>
          </div>
        </div>

        <div className="px-5 pb-5 shrink-0">
          <button
            onClick={onClose}
            className="w-full min-h-[48px] bg-[var(--accent)] text-[var(--text-inverse)] rounded-full py-3 text-[length:var(--fs-11)] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
          >
            Let's Go! 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunAnalysisOverlay;