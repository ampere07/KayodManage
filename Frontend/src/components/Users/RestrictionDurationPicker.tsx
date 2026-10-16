import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';

export type DurationAction = 'restrict' | 'suspend' | 'ban';

/**
 * What the admin has picked. `open` means no end date — the backend treats a
 * missing duration as "until lifted" for a restriction and "permanent" for a
 * ban. Suspension always needs one (the endpoint rejects a missing duration),
 * so it is never offered there.
 */
export type DurationChoice =
  | { kind: 'unset' }
  | { kind: 'preset'; days: number }
  | { kind: 'custom'; days: string; hours: string; minutes: string }
  | { kind: 'open' };

export const EMPTY_DURATION: DurationChoice = { kind: 'unset' };

const PRESET_DAYS = [1, 3, 7, 30];
const FIELD_LIMITS = { days: 999, hours: 23, minutes: 59 } as const;

const NOUN: Record<DurationAction, string> = {
  restrict: 'restriction',
  suspend: 'suspension',
  ban: 'ban',
};

/** True when the action can have no end date. */
export const allowsOpenEnded = (action: DurationAction) => action !== 'suspend';

/**
 * The duration to send, in days (fractional for hours/minutes).
 * `undefined` = open-ended; `null` = nothing valid chosen yet.
 */
export function durationInDays(choice: DurationChoice): number | undefined | null {
  if (choice.kind === 'open') return undefined;
  if (choice.kind === 'preset') return choice.days;
  if (choice.kind === 'custom') {
    const total =
      (Number(choice.days) || 0) +
      (Number(choice.hours) || 0) / 24 +
      (Number(choice.minutes) || 0) / (24 * 60);
    return total > 0 ? total : null;
  }
  return null;
}

/** "7d 23h 2m" — the same compact form the modal's restriction countdown uses. */
const describeLength = (days: number) => {
  const totalMinutes = Math.round(days * 24 * 60);
  const parts = [
    [Math.floor(totalMinutes / 1440), 'd'],
    [Math.floor((totalMinutes % 1440) / 60), 'h'],
    [totalMinutes % 60, 'm'],
  ].filter(([n]) => n) as [number, string][];
  return parts.map(([n, unit]) => `${n}${unit}`).join(' ');
};

interface RestrictionDurationPickerProps {
  action: DurationAction;
  value: DurationChoice;
  onChange: (value: DurationChoice) => void;
}

const chipClass = (active: boolean) =>
  `h-8 px-3 rounded-full border text-xs font-bold transition-colors ${
    active
      ? 'bg-gray-900 border-gray-900 text-white'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
  }`;

const RestrictionDurationPicker: React.FC<RestrictionDurationPickerProps> = ({ action, value, onChange }) => {
  const custom = value.kind === 'custom' ? value : null;
  const days = durationInDays(value);

  const setField = (field: keyof typeof FIELD_LIMITS, raw: string) => {
    if (!custom) return;
    // Digits only, and never past the field's limit, so what's typed is what's sent.
    const digits = raw.replace(/\D/g, '').slice(0, 3);
    const clamped = digits === '' ? '' : String(Math.min(Number(digits), FIELD_LIMITS[field]));
    onChange({ ...custom, [field]: clamped });
  };

  const step = (field: keyof typeof FIELD_LIMITS, delta: number) => {
    if (!custom) return;
    const next = Math.max(0, Math.min(FIELD_LIMITS[field], (Number(custom[field]) || 0) + delta));
    onChange({ ...custom, [field]: String(next) });
  };

  let summary: React.ReactNode;
  if (value.kind === 'unset') {
    summary = <span className="text-gray-400">Choose how long the {NOUN[action]} lasts.</span>;
  } else if (value.kind === 'open') {
    summary = (
      <span className="text-gray-700">
        <span className="font-bold">{action === 'ban' ? 'Permanent' : 'No end date'}</span> — lasts until an admin restores access.
      </span>
    );
  } else if (days == null) {
    // Nothing typed yet is a prompt, not an error; explicit zeros are an error.
    const untouched = custom && !custom.days && !custom.hours && !custom.minutes;
    summary = untouched
      ? <span className="text-gray-400">Enter days, hours or minutes.</span>
      : <span className="text-red-600">Enter a duration longer than zero.</span>;
  } else {
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    summary = (
      <span className="text-gray-700">
        Ends <span className="font-bold">{format(endsAt, 'EEE, MMM d, yyyy · h:mm a')}</span>
        <span className="text-gray-400"> (for {describeLength(days)})</span>
      </span>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Duration</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label={`${NOUN[action]} duration`}>
        {PRESET_DAYS.map((preset) => (
          <button
            key={preset}
            type="button"
            data-testid={`user-action-duration-preset-${preset}`}
            aria-pressed={value.kind === 'preset' && value.days === preset}
            onClick={() => onChange({ kind: 'preset', days: preset })}
            className={chipClass(value.kind === 'preset' && value.days === preset)}
          >
            {preset} {preset === 1 ? 'day' : 'days'}
          </button>
        ))}
        {allowsOpenEnded(action) && (
          <button
            type="button"
            data-testid="user-action-duration-open"
            aria-pressed={value.kind === 'open'}
            onClick={() => onChange({ kind: 'open' })}
            className={chipClass(value.kind === 'open')}
          >
            {action === 'ban' ? 'Permanent' : 'Until lifted'}
          </button>
        )}
        <button
          type="button"
          data-testid="user-action-duration-custom"
          aria-pressed={!!custom}
          onClick={() => {
            if (custom) return;
            // Start the custom fields from the preset that was selected, if any.
            const seed = value.kind === 'preset' ? String(value.days) : '';
            onChange({ kind: 'custom', days: seed, hours: '', minutes: '' });
          }}
          className={chipClass(!!custom)}
        >
          Custom
        </button>
      </div>

      {custom && (
        <div className="grid grid-cols-3 gap-2">
          {(['days', 'hours', 'minutes'] as const).map((field) => (
            <label key={field} className="block">
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1 capitalize">{field}</span>
              <div className="flex items-center h-10 bg-gray-50 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Decrease ${field}`}
                  onClick={() => step(field, -1)}
                  className="h-full px-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  data-testid={field === 'days' ? 'user-action-duration-days' : `user-action-duration-${field}`}
                  aria-label={`${field} (max ${FIELD_LIMITS[field]})`}
                  value={custom[field]}
                  onChange={(e) => setField(field, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full min-w-0 h-full bg-transparent text-center font-bold text-gray-900 outline-none placeholder:text-gray-300"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Increase ${field}`}
                  onClick={() => step(field, 1)}
                  className="h-full px-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </label>
          ))}
        </div>
      )}

      <p className="text-xs" data-testid="user-action-duration-summary" aria-live="polite">{summary}</p>
    </div>
  );
};

export default RestrictionDurationPicker;
