import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import {
  SERVICE_CLASSES,
  SERVICE_CLASS_IDS,
  ServiceClassId,
  formatReleaseWindow,
  getServiceClass,
  normalizeServiceClass,
} from '../../constants/serviceClasses';

const ICONS = { ShieldCheck, Zap };

/**
 * ServiceClassBadge — compact marker of a category's or profession's class.
 *
 * Icon-led, and deliberately free of any duration. The hold window is the only
 * thing that separates the classes today, but the class is a classification of
 * the WORK; printing "· 5 days" next to the name teaches every admin that the
 * class *is* its payout window, and a class that later differs in some other
 * way would make every one of those labels a lie.
 *
 * Where the consequence genuinely needs stating — the picker, where the choice
 * is actually made — the window appears in prose instead.
 */
export const ServiceClassBadge: React.FC<{
  value?: string | null;
  /** Icon only, for dense rows like the profession tiles. Name moves to the tooltip. */
  iconOnly?: boolean;
  /** Render nothing on the standard class — where only the exception is worth the pixels. */
  onlyWhenNotable?: boolean;
  className?: string;
}> = ({ value, iconOnly = false, onlyWhenNotable = false, className = '' }) => {
  const definition = getServiceClass(value);
  if (onlyWhenNotable && definition.id === SERVICE_CLASSES.standard.id) return null;

  const Icon = ICONS[definition.icon];
  const tooltip = `${definition.label} — ${definition.description}`;

  if (iconOnly) {
    return (
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${definition.badgeClassName} ${className}`}
        title={tooltip}
        aria-label={definition.label}
        data-service-class={definition.id}
      >
        <Icon className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span
      // whitespace-nowrap because the tiles in the category tree are ~96px wide;
      // without it the badge wraps mid-label into two ragged lines.
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${definition.badgeClassName} ${className}`}
      title={tooltip}
      data-service-class={definition.id}
    >
      <Icon className="h-3 w-3" />
      {definition.label}
    </span>
  );
};

/**
 * ServiceClassPicker — the control that assigns a payment-release class.
 *
 * Two modes:
 *  - Category (`allowInherit` false): must pick a concrete class.
 *  - Profession (`allowInherit` true): may also pick "Inherit", which stores
 *    null and lets the category decide. Inherit is the norm; the override
 *    exists so one odd profession does not force a category to be split.
 *
 * Changing this only affects jobs created afterwards — every job snapshots its
 * own release window at creation — and the note under the control says so,
 * because "did I just change the payout date of 300 live bookings?" is the
 * first thing an admin will wonder.
 */
const ServiceClassPicker: React.FC<{
  value: string | null | undefined;
  onChange: (value: ServiceClassId | null) => void;
  allowInherit?: boolean;
  /** Class shown as the inherited fallback when `allowInherit` is set. */
  inheritedFrom?: string | null;
  disabled?: boolean;
  label?: string;
}> = ({
  value,
  onChange,
  allowInherit = false,
  inheritedFrom,
  disabled = false,
  label = 'Payment release',
}) => {
  const isInheriting = allowInherit && value == null;
  const inheritedDefinition = getServiceClass(inheritedFrom);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      <div className="space-y-2">
        {allowInherit && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              isInheriting
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="block text-sm font-medium text-gray-900">
              Inherit from category
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Currently {inheritedDefinition.label}
            </span>
          </button>
        )}

        {SERVICE_CLASS_IDS.map((id) => {
          const definition = SERVICE_CLASSES[id];
          const isSelected = !isInheriting && normalizeServiceClass(value) === id;

          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-300 hover:bg-gray-50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="flex items-center gap-2">
                {React.createElement(ICONS[definition.icon], {
                  className: 'h-4 w-4 shrink-0 text-gray-500',
                })}
                <span className="text-sm font-medium text-gray-900">
                  {definition.label}
                </span>
              </span>
              {/* The hold window lives here and nowhere else: this is the one
                  screen where someone is choosing the policy, so its
                  consequence has to be visible. Everywhere else the class is
                  identified by name and icon alone, because the window is only
                  what happens to differ between classes today. */}
              <span className="block text-xs text-gray-500 mt-1">
                {definition.description} Payment is held{' '}
                <strong className="font-semibold text-gray-700">
                  {formatReleaseWindow(definition.paymentReleaseHours)}
                </strong>{' '}
                after completion.
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Applies to jobs created from now on. Live and completed jobs keep the
        terms their clients agreed to at booking.
      </p>
    </div>
  );
};

export default ServiceClassPicker;
