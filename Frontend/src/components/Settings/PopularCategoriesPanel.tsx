import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Plus, Search, Smartphone, Star, X } from 'lucide-react';
import { settingsService } from '../../services';
import FormPanel, { FormError, inputClass, primaryButton, secondaryButton } from '../UI/FormPanel';
import PanelSection from '../UI/PanelSection';
import ProfessionIcon from './ProfessionIcon';
import { POPULAR_LIMIT, popularOf, type PopularEntry as Entry } from './taxonomy';
import type { JobCategory, Profession } from '../../types/configuration.types';

/**
 * The client home screen's Popular Categories row: which professions it shows
 * and in what order (kayod/client HomeScreen — up to 8, four to a row, after
 * any services the user picked themselves). A preview shows the row as the app
 * lays it out; nothing changes in the app until Save.
 */
const PopularCategoriesPanel: React.FC<{
  open: boolean;
  categories: JobCategory[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, categories, onClose, onSaved }) => {
  const [picked, setPicked] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saved = useMemo(() => popularOf(categories), [categories]);

  useEffect(() => {
    if (!open) return;
    setPicked(saved);
    setSearch('');
    setError(null);
    bodyRef.current?.scrollTo({ top: 0 });
    // Only on opening: a refresh behind the panel mustn't undo the reordering in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = picked.map((p) => p._id).join() !== saved.map((p) => p._id).join();
  const full = picked.length >= POPULAR_LIMIT;
  const pickedIds = new Set(picked.map((p) => p._id));

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        category,
        professions: category.professions
          .filter((p) => !pickedIds.has(p._id))
          .filter((p) => !s || p.name.toLowerCase().includes(s) || category.name.toLowerCase().includes(s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.professions.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, search, picked]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= picked.length || from === to) return;
    setPicked((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const add = (profession: Profession, categoryName: string) => {
    if (full) return;
    setPicked((list) => [...list, { ...profession, categoryName }]);
  };
  const remove = (id: string) => setPicked((list) => list.filter((p) => p._id !== id));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await settingsService.updateQuickAccessProfessions(picked.map((p) => ({ professionId: p._id })));
      toast.success(picked.length ? `Popular Categories now shows ${picked.length}` : 'Popular Categories cleared');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Couldn't save Popular Categories");
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-11 w-11 rounded-xl bg-amber-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Client home screen</p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight">Popular Categories</h2>
        <p className="text-[11px] text-gray-500 truncate">The services every client sees first, up to {POPULAR_LIMIT}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <p className={`text-[11px] font-medium ${full ? 'text-amber-700' : 'text-gray-500'}`} data-testid="popular-count">
        {picked.length} of {POPULAR_LIMIT} places used
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={secondaryButton} onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className={primaryButton} disabled={!dirty || saving} data-testid="popular-save">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  return (
    <FormPanel open={open} onClose={onClose} onSubmit={save} testId="popular-panel" header={header} footer={footer} bodyRef={bodyRef}>
      <FormError message={error} testId="popular-error" />

      <PanelSection icon={Smartphone} label="Preview" description="How the row looks in the app" testId="popular-preview">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm max-w-[360px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">Popular Categories</span>
            <span className="text-xs font-medium text-orange-600">See all</span>
          </div>
          {picked.length ? (
            <div className="grid grid-cols-4 gap-x-2 gap-y-3" data-testid="popular-preview-grid">
              {picked.map((p) => (
                <div key={p._id} className="flex flex-col items-center gap-1 min-w-0">
                  <ProfessionIcon name={p.name} updatedAt={p.updatedAt} size="md" />
                  <span className="text-[10px] leading-tight text-center text-gray-700 line-clamp-2 w-full">{p.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-gray-500">Empty: clients without picks of their own see no popular services.</p>
          )}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Clients who chose services of their own see those first; yours fill the rest of the {POPULAR_LIMIT} places.</p>
      </PanelSection>

      <PanelSection icon={ListOrdered} label="Order" description="Left to right, then the next row" testId="popular-order">
        {picked.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing picked yet. Add professions below.</p>
        ) : (
          <ol className="rounded-lg border border-gray-100 divide-y divide-gray-100" data-testid="popular-list">
            {picked.map((p, index) => (
              <li
                key={p._id}
                draggable
                onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === index) return;
                  move(dragIndex, index);
                  setDragIndex(index);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-2.5 px-2.5 py-2 bg-white ${dragIndex === index ? 'opacity-50' : ''}`}
                data-testid="popular-row"
              >
                <GripVertical className="h-4 w-4 text-gray-300 cursor-grab flex-shrink-0" aria-hidden="true" />
                <span className="w-5 text-xs font-bold text-gray-400 tabular-nums flex-shrink-0">{index + 1}</span>
                <ProfessionIcon name={p.name} updatedAt={p.updatedAt} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{p.categoryName}</span>
                </span>
                <span className="flex items-center flex-shrink-0">
                  <button type="button" aria-label={`Move ${p.name} up`} disabled={index === 0} onClick={() => move(index, index - 1)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={`Move ${p.name} down`} disabled={index === picked.length - 1} onClick={() => move(index, index + 1)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => remove(p._id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </PanelSection>

      <PanelSection icon={Plus} label="Add" description={full ? `All ${POPULAR_LIMIT} places are taken: remove one to add another` : 'Any profession, from any category'} testId="popular-add" last>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search professions or categories..." className={`${inputClass} pl-8`} data-testid="popular-search" />
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">{search ? 'Nothing matches that search.' : 'Every profession is already picked.'}</p>
        ) : (
          <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
            {groups.map(({ category, professions }) => (
              <div key={category._id}>
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">{category.name}</p>
                {professions.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => add(p, category.name)}
                    disabled={full}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="popular-option"
                  >
                    <ProfessionIcon name={p.name} updatedAt={p.updatedAt} size="sm" />
                    <span className="min-w-0 flex-1 text-sm text-gray-800 truncate">{p.name}</span>
                    <Plus className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </FormPanel>
  );
};

export default PopularCategoriesPanel;
