import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FolderInput, ImageIcon, Star, Tag, Trash2, Upload, Users } from 'lucide-react';
import { settingsService } from '../../services';
import FormPanel, { Field, FormError, dangerButton, inputClass, primaryButton, secondaryButton } from '../UI/FormPanel';
import PanelSection from '../UI/PanelSection';
import ServiceClassPicker from './ServiceClassPicker';
import ProfessionIcon from './ProfessionIcon';
import {
  POPULAR_LIMIT,
  className as classLabel,
  effectiveClass,
  jobsText,
  professionIconFile,
  professionIconUrl,
  providersText,
  usageLine,
  useIconStates,
  type Usage,
} from './taxonomy';
import type { ServiceClassId } from '../../constants/serviceClasses';
import type { JobCategory, Profession, UpdateProfessionRequest } from '../../types/configuration.types';

const MAX_ICON_BYTES = 5 * 1024 * 1024;

const Fact: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({ label, value, testId }) => (
  <div className="min-w-0" data-testid={testId}>
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className="text-sm font-semibold text-gray-900 mt-0.5">{value}</dd>
  </div>
);

interface ProfessionPanelProps {
  open: boolean;
  /** The category it's in, or will be added to. */
  category: JobCategory;
  /** null: adding a new profession to `category`. */
  profession: Profession | null;
  /** Every category, for moving it. */
  categories: JobCategory[];
  usage?: Usage;
  /** Its place under Popular Categories (1-based), or null. */
  popularRank?: number | null;
  /** 1 when opened from the category panel. */
  layer?: 0 | 1;
  onClose: () => void;
  /** After any write: refresh the categories and their usage. */
  onSaved: () => void;
  onManagePopular?: () => void;
}

/**
 * One profession, in the details-panel standard: what clients see for it (the
 * icon the app loads), what it is (name and payment terms), who uses it, and
 * where it's listed (its category, with a move). Nothing is written until Save
 * — an icon picked here is only uploaded then, under the final name, so
 * closing the panel never changes what the app shows.
 */
const ProfessionPanel: React.FC<ProfessionPanelProps> = ({
  open,
  category,
  profession,
  categories,
  usage,
  popularRank,
  layer = 0,
  onClose,
  onSaved,
  onManagePopular,
}) => {
  const isNew = !profession;
  const [name, setName] = useState('');
  // null = inherit the category's class, which is what most professions do.
  const [override, setOverride] = useState<ServiceClassId | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<null | 'saving' | 'uploading' | 'deleting'>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A fresh form for each profession opened.
  useEffect(() => {
    if (!open) return;
    setName(profession?.name || '');
    setOverride(profession?.serviceClass ?? null);
    setPendingFile(null);
    setPendingPreview(null);
    setMoveTo('');
    setConfirmDelete(false);
    setError(null);
    bodyRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profession?._id]);

  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  const trimmed = name.trim();
  const nameChanged = !isNew && trimmed !== profession.name;
  const classChanged = !isNew && (override ?? null) !== (profession.serviceClass ?? null);
  const dirty = isNew ? Boolean(trimmed) : nameChanged || classChanged || Boolean(pendingFile) || Boolean(moveTo);

  // The icon the app shows today, by its saved name. A new profession isn't
  // looked up while it's being typed (every keystroke would be a request).
  const iconName = isNew ? '' : profession.name;
  const iconUrl = iconName ? professionIconUrl(iconName, profession?.updatedAt) : '';
  const iconStateOf = useIconStates(iconUrl ? [iconUrl] : []);
  const iconState = iconUrl ? iconStateOf(iconUrl) : 'loading';

  const others = useMemo(
    () => categories.filter((c) => c._id !== category._id).sort((a, b) => a.name.localeCompare(b.name)),
    [categories, category._id]
  );
  const target = others.find((c) => c._id === moveTo) || null;
  const currentClass = effectiveClass({ serviceClass: override }, category);
  const movedClass = target ? effectiveClass({ serviceClass: override }, target) : null;

  const stage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file (PNG, JPG or WebP)');
    if (file.size > MAX_ICON_BYTES) return setError('That image is over 5 MB');
    setError(null);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  /** Upload the staged icon under `finalName`; null when the admin cancelled it. */
  const upload = async (file: File, finalName: string, oldIcon: string | undefined, professionId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await settingsService.uploadProfessionIcon(file, finalName, oldIcon, professionId, controller.signal);
      return response.iconName as string;
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return null;
      throw err;
    } finally {
      abortRef.current = null;
    }
  };

  const fail = (err: any, fallback: string) => {
    setError(err?.response?.data?.message || err?.message || fallback);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || confirmDelete) return;
    if (!trimmed) return setError('Give the profession a name');
    if (!dirty) return;
    setError(null);
    try {
      if (isNew) {
        setBusy('saving');
        const created = await settingsService.createProfession({ name: trimmed, categoryId: category._id, serviceClass: override });
        const newId = created?.profession?._id;
        if (pendingFile && newId) {
          setBusy('uploading');
          const icon = await upload(pendingFile, trimmed, undefined, newId);
          if (icon === null) toast(`Added ${trimmed}; the icon upload was cancelled`);
        }
        toast.success(`Added ${trimmed} to ${category.name}`);
      } else {
        let committedIcon: string | undefined;
        if (pendingFile) {
          // First, under the final name, so a rename doesn't then rename a file that's already right.
          setBusy('uploading');
          const icon = await upload(pendingFile, trimmed, profession.icon, profession._id);
          if (icon === null) {
            toast('Upload cancelled; nothing was saved');
            return;
          }
          committedIcon = icon;
        }
        setBusy('saving');
        const update: UpdateProfessionRequest = {};
        if (nameChanged) update.name = trimmed;
        if (nameChanged && committedIcon) update.icon = committedIcon;
        // Sent explicitly, null included, so going back to "inherit" really clears the override.
        if (classChanged) update.serviceClass = override;
        if (Object.keys(update).length) {
          const response = await settingsService.updateProfession(profession._id, update);
          (response?.warnings || []).forEach((warning: string) => toast.error(warning));
        }
        if (target) await settingsService.transferProfession(profession._id, target._id);
        toast.success(target ? `Saved ${trimmed} and moved it to ${target.name}` : `Saved ${trimmed}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      fail(err, isNew ? "Couldn't add the profession" : "Couldn't save the profession");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!profession) return;
    setBusy('deleting');
    try {
      await settingsService.deleteProfession(profession._id);
      toast.success(`Deleted ${profession.name}`);
      onSaved();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      fail(err, "Couldn't delete the profession");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <ProfessionIcon name={iconName || ' '} updatedAt={profession?.updatedAt} size="md" previewSrc={pendingPreview} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 truncate">
          {isNew ? 'New profession' : 'Profession'} · {category.name}
        </p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="profession-panel-title">
          {isNew ? trimmed || 'Add a profession' : profession.name}
        </h2>
        <p className="text-[11px] text-gray-500 truncate">
          {isNew ? `Clients will find it under ${category.name}` : usageLine(usage) || ' '}
        </p>
      </div>
    </div>
  );

  const impact = (() => {
    if (!usage || (!usage.providers && !usage.jobs)) return 'Nobody uses it yet.';
    const parts = [usage.providers && `${providersText(usage.providers)} list it on their profile`, usage.jobs && `${jobsText(usage.jobs)} use it`].filter(Boolean);
    return `${parts.join(' and ')}. They keep the name, but nobody can choose it for new jobs or profiles.`;
  })();

  const footer = confirmDelete && profession ? (
    <div className="space-y-2" data-testid="profession-delete-confirm">
      <p className="text-xs text-gray-700">
        <span className="font-semibold text-gray-900">Delete {profession.name}?</span> {impact}
        {popularRank ? ' It also leaves Popular Categories.' : ''}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={() => setConfirmDelete(false)} disabled={busy === 'deleting'}>
          Keep it
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy === 'deleting'}
          className="h-9 px-4 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          data-testid="profession-delete-yes"
        >
          {busy === 'deleting' ? 'Deleting…' : 'Delete profession'}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      {!isNew ? (
        <button type="button" className={`${dangerButton} inline-flex items-center gap-1.5`} onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)} data-testid="profession-delete">
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={secondaryButton}
          onClick={busy === 'uploading' ? () => abortRef.current?.abort() : onClose}
        >
          {busy === 'uploading' ? 'Cancel upload' : 'Cancel'}
        </button>
        <button type="submit" className={primaryButton} disabled={!dirty || Boolean(busy)} data-testid="profession-save">
          {busy === 'uploading' ? 'Uploading…' : busy ? 'Saving…' : isNew ? 'Add profession' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const iconStatus = pendingFile
    ? { text: "New image chosen. It's uploaded when you save.", tone: 'text-blue-700' }
    : isNew
      ? { text: 'Optional: upload one now, or later from its tile.', tone: 'text-gray-500' }
      : iconState === 'missing'
        ? { text: 'No icon in the app yet: clients see an empty tile. Upload one below.', tone: 'text-amber-700' }
        : iconState === 'ok'
          ? { text: 'This is what clients see in the app.', tone: 'text-emerald-700' }
          : { text: "Checking the app's icon…", tone: 'text-gray-500' };

  return (
    <FormPanel open={open} onClose={onClose} onSubmit={save} testId="profession-panel" header={header} footer={footer} bodyRef={bodyRef} layer={layer}>
      <FormError message={error} testId="profession-error" />

      <PanelSection icon={ImageIcon} label="Icon" description="What clients see for it in the app" testId="profession-icon">
        <div className="flex items-start gap-4">
          <ProfessionIcon name={iconName || ' '} updatedAt={profession?.updatedAt} size="lg" previewSrc={pendingPreview} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className={`text-sm font-medium ${iconStatus.tone}`} data-testid="profession-icon-status">{iconStatus.text}</p>
            {(trimmed || iconName) && (
              <p className="text-[11px] text-gray-500 break-words">
                Stored as <span className="font-mono text-gray-600">{professionIconFile(trimmed || iconName)}</span>, the file the app looks for.
              </p>
            )}
            {pendingFile && (
              <button type="button" onClick={() => { setPendingFile(null); setPendingPreview(null); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Keep the current icon
              </button>
            )}
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); stage(e.dataTransfer.files?.[0]); }}
          className={`mt-3 flex flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          data-testid="profession-icon-drop"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
            <Upload className="h-4 w-4" />
            {dragging ? 'Drop the image here' : pendingFile ? 'Choose another image' : 'Upload a new icon'}
          </span>
          <span className="text-[11px] text-gray-400">PNG, JPG or WebP up to 5 MB. A square image on a transparent background looks best.</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="profession-icon-file" onChange={(e) => { stage(e.target.files?.[0]); e.target.value = ''; }} />
      </PanelSection>

      <PanelSection icon={Tag} label="Details" description="Its name and how long its jobs hold payment" testId="profession-details" last={isNew}>
        <div className="space-y-4">
          <Field
            label="Name"
            required
            hint={
              nameChanged ? (
                <span className="text-amber-700" data-testid="profession-rename-note">
                  {usage?.jobs ? `Its ${jobsText(usage.jobs)} are renamed too. ` : ''}
                  {/* updateProfession cascades to jobs and drafts, not to provider profiles. */}
                  {usage?.providers
                    ? `${providersText(usage.providers)} list it as “${profession?.name}”; their profiles keep that name, so they'll no longer show under it. `
                    : ''}
                  {profession?.icon?.startsWith('ik:')
                    ? 'Its uploaded icon is renamed to match, so the app keeps finding it.'
                    : iconState === 'ok'
                      ? "Its icon isn't linked to this profession, so it won't follow the new name: upload it again after saving."
                      : ''}
                </span>
              ) : undefined
            }
          >
            <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auto Electrician" autoComplete="off" className={inputClass} autoFocus={isNew} />
          </Field>
          <ServiceClassPicker value={override} onChange={setOverride} allowInherit inheritedFrom={category.serviceClass} label="Payment release" />
        </div>
      </PanelSection>

      {!isNew && (
        <>
          <PanelSection icon={Users} label="In use" description="Who offers it and how often it's booked" testId="profession-usage">
            <dl className="grid grid-cols-3 gap-3">
              <Fact label="Providers" value={usage ? usage.providers.toLocaleString() : '–'} testId="profession-usage-providers" />
              <Fact label="Jobs" value={usage ? usage.jobs.toLocaleString() : '–'} testId="profession-usage-jobs" />
              <Fact label="Running now" value={usage ? usage.activeJobs.toLocaleString() : '–'} />
            </dl>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs text-gray-700 min-w-0" data-testid="profession-popular">
                <Star className={`h-3.5 w-3.5 flex-shrink-0 ${popularRank ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                <span className="truncate">
                  {popularRank ? `#${popularRank} of ${POPULAR_LIMIT} under Popular Categories on the home screen` : 'Not under Popular Categories on the home screen'}
                </span>
              </p>
              {onManagePopular && (
                <button type="button" onClick={onManagePopular} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex-shrink-0">
                  Manage
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              Added {format(new Date(profession.createdAt), 'MMM d, yyyy')} · last changed {format(new Date(profession.updatedAt), 'MMM d, yyyy')}
            </p>
          </PanelSection>

          <PanelSection icon={FolderInput} label="Category" description="Where clients find it in the app" testId="profession-category" last>
            <Field label="Listed under">
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputClass} data-testid="profession-move">
                <option value="">{category.name} (where it is now)</option>
                {others.map((c) => (
                  <option key={c._id} value={c._id}>Move to {c.name}</option>
                ))}
              </select>
            </Field>
            {target && movedClass && (
              <p className={`mt-2 text-xs ${movedClass !== currentClass ? 'text-amber-700' : 'text-gray-600'}`} data-testid="profession-move-note">
                Moves to <span className="font-semibold">{target.name}</span> when you save. New jobs will hold payment as{' '}
                <span className="font-semibold">{classLabel(movedClass)}</span>
                {override ? ' (its own setting)' : ` (${target.name}'s setting)`}
                {movedClass !== currentClass ? `, not ${classLabel(currentClass)} as now` : ''}. Jobs already posted keep their category.
              </p>
            )}
          </PanelSection>
        </>
      )}
    </FormPanel>
  );
};

export default ProfessionPanel;
