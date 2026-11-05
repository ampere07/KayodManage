import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { AlertTriangle, Clock, KeyRound, LayoutGrid, MapPin, Monitor, ShieldCheck, Smartphone, Tablet, UserRound } from 'lucide-react';
import { settingsService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import PanelSection from '../UI/PanelSection';
import AdminActivityPanel from '../Audit/AdminActivityPanel';
import { exactTime, initials, roleText, shortTime, timeAgo } from '../Audit/auditStyle';
import {
  AccessPill,
  AdminPanelFrame,
  FormError,
  PermissionFields,
  ProfileFields,
  RoleFields,
  emptyAdminForm,
  formProblem,
  inputClass,
  splitName,
  type AdminFormValues,
} from './AdminForm';
import { NO_PERMISSIONS, canSignIn, daysSince, roleKeyOf, roleOf, signInConcern } from './adminAccess';

interface EditAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  admin: { _id: string; fullName: string; email: string; role: string } | null;
}

interface AdminDetails {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  userType: string;
  location?: string;
  accountStatus: string;
  permissions?: Partial<AdminFormValues['permissions']>;
  createdAt?: string;
  lastLogin?: string | null;
}

type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

interface Place {
  label: string;
  isLocal?: boolean;
}

/** A live session (GET /admins/:id/sessions). Keyed by a hash; the session id never reaches the browser. */
interface AdminSession {
  id: string;
  device: string;
  deviceType: DeviceType;
  ipAddress: string | null;
  /** The IP it signed in from, when it's since been used from another. */
  signInIp: string | null;
  location: Place;
  signedInAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
}

/** A past sign-in, from its audit entry. */
interface SignIn {
  id: string;
  at: string;
  device: string;
  deviceType: DeviceType;
  ipAddress: string | null;
  location: Place;
}

const DEVICE_ICON: Record<DeviceType, React.ElementType> = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Monitor };

/** "Manila, Philippines · 203.0.113.7" */
const Where: React.FC<{ location: Place; ip: string | null; testId?: string }> = ({ location, ip, testId }) => (
  <p className="flex items-center gap-1 text-[11px] text-gray-600 min-w-0" data-testid={testId}>
    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
    <span className="truncate">
      {location.label}
      <span className="text-gray-300"> · </span>
      <span className="font-mono text-gray-500">{ip || 'IP not recorded'}</span>
    </span>
  </p>
);

const toForm = (admin: AdminDetails): AdminFormValues => ({
  ...emptyAdminForm,
  ...splitName(admin.name),
  email: admin.email || '',
  phone: admin.phone || '',
  location: admin.location || '',
  userType: admin.userType || 'admin',
  accountStatus: admin.accountStatus || 'active',
  permissions: { ...NO_PERMISSIONS, ...(admin.permissions || {}) },
});

const Banner: React.FC<{ tone: 'red' | 'amber'; testId: string; children: React.ReactNode }> = ({ tone, testId, children }) => (
  <div
    data-testid={testId}
    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
  >
    <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-px ${tone === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
    <span>{children}</span>
  </div>
);

/**
 * Edit one admin account, in the details-panel standard (UI/PanelSection),
 * who → what → when → where:
 *   Profile (who they are) · Role & access and Permissions (what they can do) ·
 *   Activity (when they joined, signed in and last acted) · Sign-in (their
 *   password, and where they're signed in now).
 * Only controls that do something are here: a new password goes through the
 * same PATCH as everything else and is audit-logged; there is no delete.
 */
const EditAdminModal: React.FC<EditAdminModalProps> = ({ isOpen, onClose, onSuccess, admin }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminId = isOpen ? admin?._id : undefined;
  const bodyRef = useRef<HTMLDivElement>(null);

  const details = useQuery({
    queryKey: ['admins', adminId, 'details'],
    queryFn: async () => (await settingsService.getAdminById(adminId!)).admin as AdminDetails,
    enabled: Boolean(adminId),
    staleTime: 0,
    // A refetch would overwrite what's being typed.
    refetchOnWindowFocus: false,
  });
  const sessions = useQuery({
    queryKey: ['admins', adminId, 'sessions'],
    queryFn: async () => {
      const response = await settingsService.getAdminSessions(adminId!);
      return { live: (response.sessions || []) as AdminSession[], recent: (response.recentSignIns || []) as SignIn[] };
    },
    enabled: Boolean(adminId),
    // Where they're signed in changes while the panel is open; this doesn't touch the form.
    refetchInterval: 60_000,
  });

  const [values, setValues] = useState<AdminFormValues>(emptyAdminForm);
  const [initial, setInitial] = useState<AdminFormValues | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fill the form once per admin opened, from what the server holds now.
  useEffect(() => {
    if (!isOpen) {
      setLoadedFor(null);
      setError(null);
      return;
    }
    if (details.data && adminId && loadedFor !== adminId) {
      const form = toForm(details.data);
      setValues(form);
      setInitial(form);
      setLoadedFor(adminId);
      setError(null);
      bodyRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen, adminId, details.data, loadedFor]);

  const dirty = useMemo(() => Boolean(initial) && JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const change = (patch: Partial<AdminFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  const saved = details.data;
  const ready = Boolean(saved && loadedFor === adminId);
  const name = saved?.name || admin?.fullName || 'Admin';
  const first = splitName(name).firstName || name;
  const myId = user?.id || user?._id || user?.adminId || user?.userId;
  const isSelf = Boolean(myId && admin && String(myId) === String(admin._id));
  const locked = isSelf && roleKeyOf(initial?.userType) === 'superadmin' && initial?.accountStatus === 'active'
    ? "This is your account: you can't remove your own superadmin access or turn your own access off."
    : undefined;
  const concern = saved ? signInConcern(saved) : null;
  // The list's labels ("Support", not "Customer support").
  const role = roleOf(saved?.userType || admin?.role);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !dirty || saving) return;
    const problem = formProblem(values, false);
    if (problem) {
      setError(problem);
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const fullName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
    try {
      setSaving(true);
      setError(null);
      await settingsService.updateAdmin(admin._id, {
        name: fullName,
        email: values.email.trim(),
        phone: values.phone.trim(),
        location: values.location.trim(),
        userType: values.userType,
        accountStatus: values.accountStatus,
        permissions: values.permissions,
        ...(values.password ? { newPassword: values.password } : {}),
      });
      toast.success(`Saved ${fullName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Couldn't save the changes");
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const openLog = (entryId?: string) => {
    if (!admin) return;
    onClose();
    navigate(`/activity?admin=${admin._id}&range=all${entryId ? `&entry=${entryId}` : ''}`);
  };

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="h-11 w-11 rounded-full bg-blue-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold text-blue-600">{initials(name)}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider truncate">
          <span className={roleText(role?.value)}>{role?.label || 'Admin'}</span>
          {admin && <span className="font-mono font-semibold normal-case tracking-normal text-gray-400"> · KYD-{admin._id.slice(-6).toUpperCase()}</span>}
        </p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="admin-panel-title">{name}</h2>
        <p className="text-[11px] text-gray-500 truncate">{saved?.email || admin?.email}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] min-w-0 truncate" data-testid="admin-dirty">
        {dirty && (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
        )}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="admin-save"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const live = sessions.data?.live || [];
  const recent = sessions.data?.recent || [];

  return (
    <AdminPanelFrame open={isOpen} onClose={onClose} onSubmit={save} testId="admin-panel" header={header} footer={footer} bodyRef={bodyRef}>
      {!ready ? (
        details.isError ? (
          <div className="p-12 text-center">
            <p className="text-gray-700 font-semibold">This admin couldn't be loaded</p>
            <p className="text-sm text-gray-500 mt-1">Close the panel and try again.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )
      ) : (
        <>
          <FormError message={error} />

          {/* Where the account stands; banners only when something needs a look. */}
          <div className="px-5 md:px-6 py-4 border-b border-gray-100 space-y-3" data-testid="admin-summary">
            <div className="flex items-center justify-between gap-3">
              <AccessPill status={saved!.accountStatus} testId="admin-access-pill" />
              {live.length > 0 ? (
                <span className="text-[11px] font-medium text-emerald-700 truncate" data-testid="admin-signed-in">
                  Signed in now · {live[0].location.label}
                  {live.length > 1 && ` +${live.length - 1} more`}
                </span>
              ) : (
                <span className={`text-[11px] truncate ${concern ? 'font-medium text-amber-700' : 'text-gray-500'}`} data-testid="admin-signed-in">
                  {saved!.lastLogin ? `Last signed in ${timeAgo(saved!.lastLogin)}` : 'Never signed in'}
                </span>
              )}
            </div>
            {!canSignIn(saved!.accountStatus) && (
              <Banner tone="red" testId="admin-banner-off">
                Access is {saved!.accountStatus}, so {first} can't sign in. Set Access to Active to let them back in.
              </Banner>
            )}
            {concern === 'inactive' && saved!.lastLogin && (
              <Banner tone="amber" testId="admin-banner-inactive">
                {first} hasn't signed in for {daysSince(saved!.lastLogin)} days. If they no longer need the portal, set Access to Suspended.
              </Banner>
            )}
          </div>

          <PanelSection icon={UserRound} label="Profile" description="Who they are and how to reach them" testId="admin-profile">
            <ProfileFields values={values} onChange={change} />
          </PanelSection>

          <PanelSection icon={ShieldCheck} label="Role & access" description="What kind of admin they are, and whether they can sign in" testId="admin-role">
            <RoleFields values={values} onChange={change} locked={locked} />
          </PanelSection>

          <PanelSection icon={LayoutGrid} label="Permissions" description="Which pages they see in the sidebar" testId="admin-permissions">
            <PermissionFields values={values} onChange={change} />
          </PanelSection>

          <PanelSection icon={Clock} label="Activity" description="When they joined, signed in and last acted" testId="admin-activity">
            <AdminActivityPanel
              adminId={admin!._id}
              createdAt={saved!.createdAt}
              onOpenAuditLog={() => openLog()}
              onOpenEntry={(entryId) => openLog(entryId)}
            />
          </PanelSection>

          <PanelSection icon={KeyRound} label="Sign-in" description="Where they're signed in, from which device, and their password" testId="admin-signin" last>
            <div data-testid="admin-sessions-block">
              <p className="text-[11px] font-medium text-gray-500 mb-1.5">
                Signed in now{live.length > 0 && <span className="text-gray-400"> · {live.length} {live.length === 1 ? 'session' : 'sessions'}</span>}
              </p>
              {sessions.isLoading ? (
                <div className="h-16 rounded-lg bg-gray-50 animate-pulse" />
              ) : sessions.isError ? (
                <p className="text-sm text-gray-500">Couldn't load their sessions.</p>
              ) : live.length === 0 ? (
                <p className="text-sm text-gray-500" data-testid="admin-sessions-none">Not signed in anywhere right now.</p>
              ) : (
                <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid="admin-sessions">
                  {live.map((session) => {
                    const Icon = DEVICE_ICON[session.deviceType] || Monitor;
                    return (
                      <li key={session.id} className="flex items-start gap-3 px-3 py-2.5" data-testid="admin-session">
                        <Icon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate" data-testid="admin-session-device">{session.device}</span>
                            {session.isCurrent ? (
                              <span className="text-[11px] font-semibold text-emerald-700 flex-shrink-0">This session</span>
                            ) : session.lastSeenAt ? (
                              <span className="text-[11px] text-gray-500 flex-shrink-0" title={exactTime(session.lastSeenAt)} data-testid="admin-session-seen">
                                Active {timeAgo(session.lastSeenAt)}
                              </span>
                            ) : null}
                          </p>
                          <Where location={session.location} ip={session.ipAddress} testId="admin-session-where" />
                          <p className="text-[11px] text-gray-400 truncate">
                            {session.signedInAt ? `Signed in ${exactTime(session.signedInAt)}` : 'Signed in before activity was tracked'}
                            {session.signInIp && ` from ${session.signInIp}`}
                            {session.expiresAt && ` · ends ${format(new Date(session.expiresAt), 'MMM d, h:mm a')}`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {recent.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-medium text-gray-500 mb-1.5">{live.length ? 'Earlier sign-ins' : 'Recent sign-ins'}</p>
                <ul className="rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid="admin-signins">
                  {recent.map((signIn) => {
                    const Icon = DEVICE_ICON[signIn.deviceType] || Monitor;
                    return (
                      <li key={signIn.id} className="flex items-start gap-3 px-3 py-2" data-testid="admin-signin-row">
                        <Icon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-800 truncate">{signIn.device}</span>
                            <span className="text-[11px] text-gray-500 flex-shrink-0" title={exactTime(signIn.at)}>{shortTime(signIn.at)}</span>
                          </p>
                          <Where location={signIn.location} ip={signIn.ipAddress} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <label className="block mt-4">
              <span className="block text-[11px] font-medium text-gray-500 mb-1">New password</span>
              <input
                type="password"
                name="newPassword"
                value={values.password}
                onChange={(e) => change({ password: e.target.value })}
                placeholder="Leave blank to keep their current password"
                autoComplete="new-password"
                className={inputClass}
                data-testid="admin-new-password"
              />
              <span className="block mt-1 text-[11px] text-gray-400">At least 6 characters. Tell them yourself; no email is sent.</span>
            </label>
          </PanelSection>
        </>
      )}
    </AdminPanelFrame>
  );
};

export default EditAdminModal;
