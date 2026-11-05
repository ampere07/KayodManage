import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LayoutGrid, ShieldCheck, UserPlus, UserRound } from 'lucide-react';
import { settingsService } from '../../services';
import PanelSection from '../UI/PanelSection';
import {
  AdminPanelFrame,
  FormError,
  PermissionFields,
  ProfileFields,
  RoleFields,
  emptyAdminForm,
  formProblem,
  type AdminFormValues,
} from './AdminForm';

interface CreateAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * A new admin account, in the same panel and sections as Edit Admin: Profile
 * (with the password they'll sign in with), Role & access, and Permissions.
 */
const CreateAdminModal: React.FC<CreateAdminModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [values, setValues] = useState<AdminFormValues>(emptyAdminForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Every opening starts from a blank form.
  useEffect(() => {
    if (isOpen) {
      setValues(emptyAdminForm);
      setError(null);
    }
  }, [isOpen]);

  const change = (patch: Partial<AdminFormValues>) => setValues((prev) => ({ ...prev, ...patch }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problem = formProblem(values, true);
    if (problem) {
      setError(problem);
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const name = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();
    try {
      setSaving(true);
      setError(null);
      await settingsService.createAdmin({
        name,
        email: values.email.trim(),
        password: values.password,
        phone: values.phone.trim(),
        location: values.location.trim(),
        userType: values.userType,
        accountStatus: values.accountStatus,
        permissions: values.permissions,
      });
      toast.success(`Created ${name}'s account`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Couldn't create the admin");
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="h-11 w-11 rounded-full bg-blue-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <UserPlus className="h-5 w-5 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">New admin</p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="admin-panel-title">Create an admin account</h2>
        <p className="text-[11px] text-gray-500 truncate">They sign in with the email and password you set here</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="h-9 px-4 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        data-testid="admin-create"
      >
        {saving ? 'Creating…' : 'Create Admin'}
      </button>
    </div>
  );

  return (
    <AdminPanelFrame open={isOpen} onClose={onClose} onSubmit={create} testId="admin-create-panel" header={header} footer={footer} bodyRef={bodyRef}>
      <FormError message={error} />
      <PanelSection icon={UserRound} label="Profile" description="Who they are, how to reach them, and their password" testId="admin-profile">
        <ProfileFields values={values} onChange={change} withPassword />
      </PanelSection>
      <PanelSection icon={ShieldCheck} label="Role & access" description="What kind of admin they are, and whether they can sign in" testId="admin-role">
        <RoleFields values={values} onChange={change} />
      </PanelSection>
      <PanelSection icon={LayoutGrid} label="Permissions" description="Which pages they see in the sidebar" testId="admin-permissions" last>
        <PermissionFields values={values} onChange={change} />
      </PanelSection>
    </AdminPanelFrame>
  );
};

export default CreateAdminModal;
