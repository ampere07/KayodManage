import React from 'react';
import { AlertTriangle } from 'lucide-react';
import FormPanel, { Field, FormError as SharedFormError, inputClass } from '../UI/FormPanel';
import { roleText } from '../Audit/auditStyle';
import {
  ACCESS_OPTIONS,
  NO_PERMISSIONS,
  PAGES,
  PRESETS,
  ROLES,
  pagesOn,
  permissionsFor,
  presetOf,
  roleKeyOf,
  type Permissions,
} from './adminAccess';

/** Everything the create and edit panels collect. `password` is the new password when editing. */
export interface AdminFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  password: string;
  userType: string;
  accountStatus: string;
  permissions: Permissions;
}

export const emptyAdminForm: AdminFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  password: '',
  userType: 'admin',
  accountStatus: 'active',
  permissions: NO_PERMISSIONS,
};

export type AdminFormChange = (patch: Partial<AdminFormValues>) => void;

export { inputClass };

/** Name and contact details, plus the password when creating an account. */
export const ProfileFields: React.FC<{ values: AdminFormValues; onChange: AdminFormChange; withPassword?: boolean }> = ({ values, onChange, withPassword }) => {
  const text = (name: 'firstName' | 'lastName' | 'email' | 'phone' | 'location' | 'password') => ({
    name,
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [name]: e.target.value }),
    className: inputClass,
  });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="First name" required>
        <input type="text" placeholder="First name" autoComplete="off" {...text('firstName')} />
      </Field>
      <Field label="Last name" required>
        <input type="text" placeholder="Last name" autoComplete="off" {...text('lastName')} />
      </Field>
      <Field label="Email" required wide>
        <input type="email" placeholder="name@kayod.com" autoComplete="off" {...text('email')} />
      </Field>
      {withPassword && (
        <Field label="Password" required wide hint="At least 6 characters. Share it with them yourself; no email is sent.">
          <input type="password" placeholder="Minimum 6 characters" autoComplete="new-password" {...text('password')} />
        </Field>
      )}
      <Field label="Phone" required>
        <input type="tel" placeholder="+63 900 000 0000" autoComplete="off" {...text('phone')} />
      </Field>
      <Field label="Location" required>
        <input type="text" placeholder="Office location" autoComplete="off" {...text('location')} />
      </Field>
    </div>
  );
};

/** The role and whether the account can sign in. `locked` explains why they can't change. */
export const RoleFields: React.FC<{ values: AdminFormValues; onChange: AdminFormChange; locked?: string }> = ({ values, onChange, locked }) => {
  const current = roleKeyOf(values.userType);
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ROLES.map((role) => {
          const selected = current === role.key;
          return (
            <button
              key={role.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={Boolean(locked) && !selected}
              onClick={() => onChange({ userType: role.value })}
              data-testid={`admin-role-${role.key}`}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                selected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${roleText(role.value)}`}>{role.label}</span>
                <span className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-blue-600' : 'border-gray-300'}`}>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                </span>
              </span>
              <span className="block text-xs text-gray-600 mt-0.5">{role.description}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Access" required hint="Suspended and banned admins can't sign in.">
          <select
            name="accountStatus"
            value={values.accountStatus}
            disabled={Boolean(locked)}
            onChange={(e) => onChange({ accountStatus: e.target.value })}
            className={inputClass}
            data-testid="admin-access"
          >
            {ACCESS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
      </div>
      {locked && <p className="text-[11px] text-gray-500" data-testid="admin-role-locked">{locked}</p>}
    </div>
  );
};

/** Which pages the account sees: a preset to start from, then one box per page. */
export const PermissionFields: React.FC<{ values: AdminFormValues; onChange: AdminFormChange }> = ({ values, onChange }) => {
  const preset = presetOf(values.permissions);
  const on = pagesOn(values.permissions).length;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-medium text-gray-500 mb-1.5">Start from</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((option) => {
            const selected = preset?.key === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={selected}
                title={option.description}
                onClick={() => onChange({ permissions: permissionsFor(option.pages) })}
                data-testid={`admin-preset-${option.key}`}
                className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {!preset && on > 0 && (
            <span className="h-8 px-2 inline-flex items-center text-xs font-semibold text-gray-500" data-testid="admin-preset-custom">Custom</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 rounded-lg border border-gray-100 px-3 py-3" data-testid="admin-pages">
        {PAGES.map((page) => (
          <label key={page.key} className="flex items-center gap-2 cursor-pointer min-w-0">
            <input
              type="checkbox"
              checked={Boolean(values.permissions[page.key])}
              onChange={() => onChange({ permissions: { ...values.permissions, [page.key]: !values.permissions[page.key] } })}
              data-testid={`admin-page-${page.key}`}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800 truncate">{page.label}</span>
          </label>
        ))}
      </div>
      {on === 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700" data-testid="admin-pages-none">
          <AlertTriangle className="h-3.5 w-3.5" /> No pages yet: they'd see an empty sidebar.
        </p>
      ) : (
        <p className="text-[11px] text-gray-500" data-testid="admin-pages-count">{on} of {PAGES.length} pages</p>
      )}
    </div>
  );
};

/** First and last name from the one name field the server keeps. */
export const splitName = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

/** What's missing before the form can be sent, or null. */
export const formProblem = (values: AdminFormValues, passwordRequired: boolean) => {
  const missing = (['firstName', 'lastName', 'email', 'phone', 'location'] as const).some((key) => !values[key].trim());
  if (missing || (passwordRequired && !values.password)) return 'Fill in every field marked *';
  // The same rule the browser applied to the old type="email" input.
  if (!/^[^\s@]+@[^\s@]+$/.test(values.email.trim())) return 'Enter a valid email address';
  if (values.password && values.password.length < 6) return 'The password needs at least 6 characters';
  return null;
};

/** The panel both admin forms sit in: the shared side panel (UI/FormPanel). */
export const AdminPanelFrame = FormPanel;

/** Whether the account can sign in, in the Audit Log admins table's style. */
export const AccessPill: React.FC<{ status?: string; small?: boolean; testId?: string }> = ({ status, small, testId }) => {
  const off = status !== 'active';
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase whitespace-nowrap ${
        small ? 'px-2 py-0.5 text-[9px] tracking-tight' : 'px-2.5 py-1 text-[10px] tracking-wider'
      } ${off ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${off ? 'bg-red-500' : 'bg-emerald-500'}`} />
      {off ? status || 'Unknown' : 'Active'}
    </span>
  );
};

/** An inline problem at the top of a form. */
export const FormError: React.FC<{ message: string | null }> = ({ message }) => (
  <SharedFormError message={message} testId="admin-form-error" />
);
