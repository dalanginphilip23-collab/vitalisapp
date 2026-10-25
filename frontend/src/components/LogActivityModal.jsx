import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import Input from './ui/Input.jsx';
import Button from './ui/Button.jsx';
import { EMPTY_ACTIVITY_FORM, validateActivityForm } from '../lib/activityForm.js';

const LogActivityModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState(EMPTY_ACTIVITY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (saving) return;
    setFormData(EMPTY_ACTIVITY_FORM);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    const { error: validationError, values } = validateActivityForm(formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    const { calories, steps, minutes, water } = values;
    setSaving(true);
    try {
      await onSave({ calories, steps, minutes, water });
      setFormData(EMPTY_ACTIVITY_FORM);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, val) => setFormData((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Log Activity"
      subtitle="Daily Biometric Entry"
      icon="edit_note"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="text-[length:var(--fs-11)] font-bold text-[var(--error)] bg-[var(--error-bg)] border border-[var(--error)]/30 rounded-xl px-3 py-2"
          >
            {error}
          </p>
        )}
        <Input
          label="Calories Burned"
          type="number"
          required
          min="1"
          max="20000"
          step="1"
          icon="local_fire_department"
          value={formData.calories}
          onChange={(e) => setField('calories', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Steps"
            type="number"
            min="0"
            max="200000"
            step="1"
            placeholder="10000"
            icon="footprint"
            value={formData.steps}
            onChange={(e) => setField('steps', e.target.value)}
          />
          <Input
            label="Duration"
            type="number"
            min="0"
            max="1440"
            step="1"
            placeholder="Mins"
            icon="timer"
            value={formData.minutes}
            onChange={(e) => setField('minutes', e.target.value)}
          />
        </div>
        <Input
          label="Water Intake (ml)"
          type="number"
          min="0"
          max="15000"
          step="1"
          placeholder="e.g. 2500"
          icon="water_drop"
          value={formData.water}
          onChange={(e) => setField('water', e.target.value)}
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          icon="check_circle"
          loading={saving}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Update Vitalis Dashboard'}
        </Button>
      </form>
    </Modal>
  );
};

export default LogActivityModal;
