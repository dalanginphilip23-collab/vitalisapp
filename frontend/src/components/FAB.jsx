import { useState } from 'react';
import LogActivityModal from './LogActivityModal.jsx';

// FAB — thin wrapper around LogActivityModal (unified log entry, no duplication)
// Previously had 136 lines of duplicate form; now delegates to the single source.
const FAB = ({ onSave }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Log activity"
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-[var(--accent)] rounded-full shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-50"
      >
        <span className="material-symbols-outlined text-[var(--text-inverse)] text-[length:var(--fs-32)] font-bold">add</span>
      </button>

      <LogActivityModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSave={onSave} />
    </>
  );
};

export default FAB;
