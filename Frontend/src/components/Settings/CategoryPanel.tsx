import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FolderOpen, ListTree, Plus, Star, Tag, Trash2, Users, Wallet, X } from 'lucide-react';
import { settingsService } from '../../services';
import FormPanel, { Field, FormError, dangerButton, inputClass, primaryButton, secondaryButton } from '../UI/FormPanel';
import PanelSection from '../UI/PanelSection';
import ServiceClassPicker, { ServiceClassBadge } from './ServiceClassPicker';
import ProfessionIcon from './ProfessionIcon';
import { jobsText, providersText, usageLine, type Usage, type UsageMap } from './taxonomy';
import { DEFAULT_SERVICE_CLASS, normalizeServiceClass, type ServiceClassId } from '../../constants/serviceClasses';
import type { JobCategory, Profession, UpdateJobCategoryRequest } from '../../types/configuration.types';

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-gray-500">{label}</dt>
    <dd className="text-sm font-semibold text-gray-900 mt-0.5">{value}</dd>
  </div>
);

interface CategoryPanelProps {
  open: boolean;
  /** null: creating a new category. */
  category: JobCategory | null;
  usage?: UsageMap;
  /** Profession id → its place under Popular Categories. */
  popularRank?: Map<string, number>;
  /** A profession panel is open on top: Escape is its. */
  covered?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenProfession: (category: JobCategory, profession: Profession | null) => void;
}

/**
 * One job category, in the details-panel standard: what it's called, how long
 * its jobs hold payment, the professions under it (each opens on top), and how
 * much it's used. Save writes only the category itself — professions are saved
 * from their own panel, so nothing here can overwrite them.
 *
 * With no category it creates one: name, payment release (Standard unless
 * someone deliberately picks otherwise), and any professions to start with.
 */
const CategoryPanel: React.FC<CategoryPanelProps> = ({ open, category, usage, popularRank, covered, onClose, onSaved, onOpenProfession }) => {
  const isNew = !category;
  const [name, setName] = useState('');
  const [serviceClass, setServiceClass] = useState<ServiceClassId>(DEFAULT_SERVICE_CLASS);
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<null | 'saving' | 'deleting'>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name || '');
    setServiceClass(normalizeServiceClass(category?.serviceClass));
    setDraft('');
    setStarting([]);
    setConfirmDelete(false);
    setError(null);
    bodyRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?._id]);

  const trimmed = name.trim();
  const nameChanged = !isNew && trimmed !== category.name;
  // A category with no stored class is Standard, so switching it to Immediate is a change.
  const classChanged = !isNew && serviceClass !== normalizeServiceClass(category.serviceClass);
  const dirty = isNew ? Boolean(trimmed) : nameChanged || classChanged;
  const professions = category?.professions || [];
  const overrides = professions.filter((p) => p.serviceClass != null);
  const own: Usage | undefined = category ? usage?.categories[category._id] : undefined;

  const fail = (err: any, fallback: string) => {
    setError(err?.response?.data?.message || err?.message || fallback);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || confirmDelete) return;
    if (!trimmed) return setError('Give the category a name');
    if (!dirty) return;
    setError(null);
    setBusy('saving');
    try {
      if (isNew) {
        await settingsService.createJobCategory({
          name: trimmed,
          // Sent explicitly: a new category never ends up on a shorter hold by omission.
          serviceClass,
          professions: starting.map((professionName) => ({ name: professionName })),
        });
        toast.success(`Created ${trimmed}${starting.length ? ` with ${starting.length} profession${starting.length === 1 ? '' : 's'}` : ''}`);
      } else {
        const update: UpdateJobCategoryRequest = {};
        if (nameChanged) update.name = trimmed;
        if (classChanged) update.serviceClass = serviceClass;
        await settingsService.updateJobCategory(category._id, update);
        toast.success(`Saved ${trimmed}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      fail(err, isNew ? "Couldn't create the category" : "Couldn't save the category");
    } finally {
      setBusy(null);
    }
  };

  /** Add a profession straight away (an existing category), or to the starting list (a new one). */
  const addProfession = async () => {
    const professionName = draft.trim();
    if (!professionName) return;
    const taken = (isNew ? starting : professions.map((p) => p.name)).some((n) => n.toLowerCase() === professionName.toLowerCase());
    if (taken) return setError(`${professionName} is already in this category`);
    setError(null);
    if (isNew) {
      setStarting((list) => [...list, professionName]);
      setDraft('');
      return;
    }
    setAdding(true);
    try {
      await settingsService.createProfession({ name: professionName, categoryId: category._id, serviceClass: null });
      toast.success(`Added ${professionName}`);
      setDraft('');
      onSaved();
    } catch (err) {
      fail(err, "Couldn't add the profession");
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    setBusy('deleting');
    try {
      await settingsService.deleteJobCategory(category._id);
      toast.success(`Deleted ${category.name}`);
      onSaved();
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      fail(err, "Couldn't delete the category");
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-11 w-11 rounded-xl bg-blue-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <FolderOpen className="h-5 w-5 text-blue-600" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isNew ? 'New category' : 'Category'}</p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="category-panel-title">
          {isNew ? trimmed || 'Create a category' : category.name}
        </h2>
        <p className="text-[11px] text-gray-500 truncate">
          {isNew
            ? 'Clients pick a category, then a profession under it'
            : `${professions.length} profession${professions.length === 1 ? '' : 's'}${own ? ` · ${usageLine(own)}` : ''}`}
        </p>
      </div>
    </div>
  );

  const deleteImpact = (() => {
    if (!category) return '';
    const parts = [
      professions.length ? `its ${professions.length} profession${professions.length === 1 ? '' : 's'} go with it` : '',
      own?.providers ? `${providersText(own.providers)} list them` : '',
      own?.jobs ? `${jobsText(own.jobs)} use this category` : '',
    ].filter(Boolean);
    return parts.length ? `${parts.join(', ')}. They keep the names, but nobody can choose them for new jobs.` : 'Nothing uses it yet.';
  })();

  const footer = confirmDelete && category ? (
    <div className="space-y-2" data-testid="category-delete-confirm">
      <p className="text-xs text-gray-700">
        <span className="font-semibold text-gray-900">Delete {category.name}?</span> {deleteImpact.charAt(0).toUpperCase() + deleteImpact.slice(1)}
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
          data-testid="category-delete-yes"
        >
          {busy === 'deleting' ? 'Deleting…' : 'Delete category'}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      {!isNew ? (
        <button type="button" className={`${dangerButton} inline-flex items-center gap-1.5`} onClick={() => setConfirmDelete(true)} disabled={Boolean(busy)} data-testid="category-delete">
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button type="button" className={secondaryButton} onClick={onClose} disabled={Boolean(busy)}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={!dirty || Boolean(busy)} data-testid="category-save">
          {busy === 'saving' ? 'Saving…' : isNew ? 'Create category' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  return (
    <FormPanel open={open} onClose={onClose} onSubmit={save} testId="category-panel" header={header} footer={footer} bodyRef={bodyRef} covered={covered}>
      <FormError message={error} testId="category-error" />

      <PanelSection icon={Tag} label="Details" description="What clients see it called" testId="category-details">
        <Field label="Name" required hint={!isNew && nameChanged ? 'Jobs already posted keep the category name they were posted with.' : undefined}>
          <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home Repair" autoComplete="off" className={inputClass} autoFocus={isNew} />
        </Field>
      </PanelSection>

      <PanelSection icon={Wallet} label="Payment release" description="How long its jobs hold payment after completion" testId="category-payment">
        <ServiceClassPicker value={serviceClass} onChange={(next) => setServiceClass(normalizeServiceClass(next))} label="Every profession here, unless it sets its own" />
        {overrides.length > 0 && (
          <p className="mt-2 text-[11px] text-gray-600" data-testid="category-overrides">
            {overrides.length === 1 ? `${overrides[0].name} sets its own` : `${overrides.length} professions set their own`}:{' '}
            {overrides.slice(0, 3).map((p) => p.name).join(', ')}
            {overrides.length > 3 ? '…' : ''}
          </p>
        )}
      </PanelSection>

      <PanelSection icon={ListTree} label="Professions" description={isNew ? 'What clients can pick under it (optional)' : 'What clients can pick under it'} testId="category-professions" last={isNew}>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addProfession();
              }
            }}
            placeholder={isNew ? 'Add a profession to start with' : 'New profession name'}
            className={inputClass}
            data-testid="category-add-name"
          />
          <button type="button" onClick={addProfession} disabled={!draft.trim() || adding} className={`${secondaryButton} inline-flex items-center gap-1 flex-shrink-0`} data-testid="category-add">
            <Plus className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {!isNew && <p className="mt-1 text-[11px] text-gray-400">Added straight away, following the category's payment release. Open it to set an icon.</p>}

        {isNew ? (
          starting.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="category-starting">
              {starting.map((professionName) => (
                <li key={professionName} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 pl-2.5 pr-1 py-1 text-xs text-gray-800">
                  {professionName}
                  <button type="button" aria-label={`Remove ${professionName}`} onClick={() => setStarting((list) => list.filter((n) => n !== professionName))} className="p-0.5 text-gray-400 hover:text-gray-600">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : professions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No professions yet.</p>
        ) : (
          <ul className="mt-3 rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid="category-profession-list">
            {[...professions].sort((a, b) => a.name.localeCompare(b.name)).map((profession) => {
              const rank = popularRank?.get(profession._id);
              return (
                <li key={profession._id}>
                  <button
                    type="button"
                    onClick={() => onOpenProfession(category, profession)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    data-testid="category-profession-row"
                  >
                    <ProfessionIcon name={profession.name} updatedAt={profession.updatedAt} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900 truncate">{profession.name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{usageLine(usage?.professions[profession._id]) || ' '}</span>
                    </span>
                    {rank && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 flex-shrink-0" title={`#${rank} under Popular Categories`}>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {rank}
                      </span>
                    )}
                    {profession.serviceClass != null && <ServiceClassBadge value={profession.serviceClass} iconOnly />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>

      {!isNew && (
        <PanelSection icon={Users} label="In use" description="Who offers it and how often it's booked" testId="category-usage" last>
          <dl className="grid grid-cols-3 gap-3">
            <Fact label="Providers" value={own ? own.providers.toLocaleString() : '–'} />
            <Fact label="Jobs" value={own ? own.jobs.toLocaleString() : '–'} />
            <Fact label="Running now" value={own ? own.activeJobs.toLocaleString() : '–'} />
          </dl>
          <p className="mt-2 text-[11px] text-gray-400">
            Added {format(new Date(category.createdAt), 'MMM d, yyyy')} · last changed {format(new Date(category.updatedAt), 'MMM d, yyyy')}
          </p>
        </PanelSection>
      )}
    </FormPanel>
  );
};

export default CategoryPanel;
