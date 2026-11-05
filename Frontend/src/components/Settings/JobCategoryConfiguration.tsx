import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight, FolderPlus, Pencil, Plus, Search, Star, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { JobCategory, Profession } from '../../types/configuration.types';
import CounterGroups from '../UI/CounterGroups';
import type { Counter, CounterGroup } from '../UI/CounterGroups';
import { ServiceClassBadge } from './ServiceClassPicker';
import ProfessionIcon from './ProfessionIcon';
import CategoryPanel from './CategoryPanel';
import ProfessionPanel from './ProfessionPanel';
import PopularCategoriesPanel from './PopularCategoriesPanel';
import {
  POPULAR_LIMIT,
  className,
  effectiveClass,
  jobsText,
  popularOf,
  professionIconUrl,
  providersText,
  useCategoryUsage,
  useIconStates,
  usageLine,
} from './taxonomy';
import { SERVICE_CLASS } from '../../constants/serviceClasses';
import { useJobCategories } from '../../hooks/useJobs';
import { useSocket } from '../../context/SocketContext';

const COLLAPSED_KEY = 'settings-collapsed-categories';

/** What the counters filter the professions by. */
type Filter = 'all' | 'standard' | 'immediate' | 'missing' | 'unused' | 'popular';

const readCollapsed = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

/**
 * Settings → Configuration → Job Category: every category and the professions
 * clients choose from, in the other list pages' style. Counters (that are also
 * filters) show how the professions split by payment release, which need a
 * look — no icon in the app, nobody offering them — and which are on the home
 * screen. Each category is a card of profession tiles showing the icon clients
 * actually see; categories and professions open in side panels to edit.
 */
const JobCategoryConfiguration: React.FC = () => {
  const queryClient = useQueryClient();
  const { categories, isLoading } = useJobCategories();
  const { data: usage } = useCategoryUsage();
  const { socket } = useSocket();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const [categoryPanel, setCategoryPanel] = useState<string | 'new' | null>(null);
  const [professionPanel, setProfessionPanel] = useState<{ categoryId: string; professionId: string | null; nested: boolean } | null>(null);
  const [popularOpen, setPopularOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      /* private mode: the page still works, it just won't remember */
    }
  }, [collapsed]);

  // Another admin's edits (and icon uploads) refresh the page.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (data: any) => {
      if (data?.type === 'profession') queryClient.invalidateQueries({ queryKey: ['job-categories'] });
    };
    socket.on('configuration:updated', onUpdate);
    return () => {
      socket.off('configuration:updated', onUpdate);
    };
  }, [socket, queryClient]);

  // Categories and their usage share the key prefix, so both refresh.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['job-categories'] });

  const sorted = useMemo(() => [...(categories as JobCategory[])].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const popular = useMemo(() => popularOf(sorted), [sorted]);
  const popularRank = useMemo(() => new Map(popular.map((p, i) => [p._id, i + 1])), [popular]);

  const iconUrls = useMemo(() => sorted.flatMap((c) => (c.professions || []).map((p) => professionIconUrl(p.name, p.updatedAt))), [sorted]);
  const iconStateOf = useIconStates(iconUrls);
  const iconsChecked = iconUrls.every((url) => iconStateOf(url) !== 'loading');

  const matches = (p: Profession, c: JobCategory, f: Filter) => {
    switch (f) {
      case 'standard':
        return effectiveClass(p, c) === SERVICE_CLASS.STANDARD;
      case 'immediate':
        return effectiveClass(p, c) === SERVICE_CLASS.IMMEDIATE;
      case 'missing':
        return iconStateOf(professionIconUrl(p.name, p.updatedAt)) === 'missing';
      case 'unused':
        return Boolean(usage) && !usage!.professions[p._id]?.providers;
      case 'popular':
        return popularRank.has(p._id);
      default:
        return true;
    }
  };

  // Search narrows the counters as well as the list: a category's name shows all of it.
  const searched = useMemo(() => {
    const s = search.trim().toLowerCase();
    return sorted
      .map((c) => ({
        category: c,
        nameMatch: !s || c.name.toLowerCase().includes(s),
        professions: (c.professions || []).filter((p) => !s || c.name.toLowerCase().includes(s) || p.name.toLowerCase().includes(s)),
      }))
      .filter((entry) => entry.nameMatch || entry.professions.length > 0);
  }, [sorted, search]);

  const countWhere = (f: Filter) => searched.reduce((n, e) => n + e.professions.filter((p) => matches(p, e.category, f)).length, 0);
  const visible = searched
    .map((e) => ({ ...e, shown: [...e.professions].filter((p) => matches(p, e.category, filter)).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((e) => filter === 'all' || e.shown.length > 0);

  const choose = (f: Filter) => setFilter((current) => (current === f ? 'all' : f));
  const cell = (key: Exclude<Filter, 'all'>, label: string, tone: Counter['tone'], hint: string, extra: Partial<Counter> = {}): Counter => ({
    key,
    label,
    tone,
    hint,
    count: isLoading ? undefined : countWhere(key),
    selected: filter === key,
    onClick: () => choose(key),
    ...extra,
  });
  const groups: CounterGroup[] = [
    {
      label: 'Payment release',
      cells: [
        cell('standard', 'Standard', 'gray', 'Professions whose jobs hold payment as a warranty'),
        cell('immediate', 'Immediate', 'emerald', 'Professions whose jobs pay out as soon as both sides confirm'),
      ],
    },
    {
      label: 'Needs a look',
      cells: [
        cell('missing', 'Missing icon', 'amber', 'The app has no icon for these: clients see an empty tile', {
          alert: true,
          shortLabel: 'No icon',
          count: isLoading || !iconsChecked ? undefined : countWhere('missing'),
        }),
        cell('unused', 'No providers', 'amber', 'No provider lists these, so jobs posted for them get no offers', {
          alert: true,
          shortLabel: 'Unused',
          count: isLoading || !usage ? undefined : countWhere('unused'),
        }),
      ],
    },
    {
      label: 'Home screen',
      cells: [cell('popular', 'Popular', 'yellow', `Shown under Popular Categories on the client home screen (up to ${POPULAR_LIMIT})`)],
    },
  ];

  const professionTotal = sorted.reduce((n, c) => n + (c.professions || []).length, 0);
  const anyFilter = filter !== 'all' || Boolean(search);
  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = visible.length > 0 && visible.every((e) => collapsed.has(e.category._id));

  // Panels.
  const panelCategory = categoryPanel && categoryPanel !== 'new' ? sorted.find((c) => c._id === categoryPanel) || null : null;
  const professionCategory = professionPanel ? sorted.find((c) => c._id === professionPanel.categoryId) || null : null;
  const panelProfession = professionPanel?.professionId && professionCategory
    ? professionCategory.professions.find((p) => p._id === professionPanel.professionId) || null
    : null;
  // A profession that's gone (deleted, or moved and so given a new id) closes its panel.
  const professionOpen = Boolean(professionPanel && professionCategory && (professionPanel.professionId === null || panelProfession));
  const openProfession = (category: JobCategory, profession: Profession | null, nested = false) =>
    setProfessionPanel({ categoryId: category._id, professionId: profession?._id ?? null, nested });
  const openPopular = () => {
    setProfessionPanel(null);
    setCategoryPanel(null);
    setPopularOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 pt-4">
          <p className="text-xs text-gray-500 font-medium mb-3" data-testid="taxonomy-summary">
            {isLoading
              ? 'Categories and professions clients choose from'
              : `${sorted.length} categor${sorted.length === 1 ? 'y' : 'ies'} · ${professionTotal} profession${professionTotal === 1 ? '' : 's'} · ${popular.length} of ${POPULAR_LIMIT} on the home screen`}
          </p>
          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.7fr_2.4fr_2.8fr_1.3fr]"
            all={{ count: isLoading ? undefined : countWhere('all'), selected: filter === 'all', onClick: () => setFilter('all') }}
            filtered={anyFilter}
            onClear={clearFilters}
            testId="taxonomy-counters"
            idPrefix="taxonomy"
            allCell={{ label: 'All', hint: 'Every profession under the search' }}
          />
        </div>
        <div className="px-4 md:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 lg:h-4 lg:w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories and professions..."
              className="w-full pl-8 pr-3 h-8 lg:h-9 lg:pl-10 bg-white border border-gray-200 rounded-lg lg:rounded-xl text-xs lg:text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              data-testid="taxonomy-search"
            />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setPopularOpen(true)}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-8 lg:h-9 px-3 rounded-lg lg:rounded-xl border border-gray-200 bg-white text-xs lg:text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              data-testid="taxonomy-popular"
            >
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              Popular Categories
              <span className="text-gray-400 font-medium">{popular.length}/{POPULAR_LIMIT}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryPanel('new')}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 h-8 lg:h-9 px-3 rounded-lg lg:rounded-xl bg-blue-600 text-xs lg:text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
              data-testid="taxonomy-new-category"
            >
              <FolderPlus className="h-4 w-4" />
              New category
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <p className="text-gray-700 font-semibold">No categories found</p>
            <p className="text-sm text-gray-500 mt-1">Create the first category clients can post jobs in.</p>
            <button type="button" onClick={() => setCategoryPanel('new')} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
              Create a category
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6" data-testid="taxonomy-empty">
            <p className="text-gray-700 font-semibold">Nothing matches</p>
            <p className="text-sm text-gray-500 mt-1">Try another search, or clear the filters.</p>
            <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
              Show everything
            </button>
          </div>
        ) : (
          <div className="p-3 md:p-6 space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(visible.map((e) => e.category._id)))}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                data-testid="taxonomy-collapse-all"
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            </div>
            {visible.map(({ category, shown }) => {
              const open = !collapsed.has(category._id);
              const own = usage?.categories[category._id];
              const total = (category.professions || []).length;
              return (
                <section key={category._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="category-card">
                  <header className={`flex items-center gap-2 px-3 md:px-4 py-3 ${open ? 'border-b border-gray-100' : ''}`}>
                    <button
                      type="button"
                      onClick={() => toggle(category._id)}
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name}`}
                      className="p-1 -ml-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 break-words min-w-0">{category.name}</h3>
                        {/* Every category shows its class, so the money behaviour is scannable in one pass. */}
                        <ServiceClassBadge value={category.serviceClass} />
                      </div>
                      <p className="text-[11px] text-gray-500 truncate" data-testid="category-card-meta">
                        {total} profession{total === 1 ? '' : 's'}
                        {filter !== 'all' || shown.length !== total ? ` · ${shown.length} shown` : ''}
                        {own ? ` · ${usageLine(own)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProfession(category, null)}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
                      title={`Add a profession to ${category.name}`}
                      data-testid="category-card-add"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Profession</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategoryPanel(category._id)}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      data-testid="category-card-edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </header>

                  {open && (
                    total === 0 ? (
                      <p className="px-4 py-5 text-sm text-gray-500 text-center">No professions yet. Add one with + Profession.</p>
                    ) : (
                      // Rectangular tiles (icon beside the name), five to a row from xl, each a fifth
                      // of the row so they fill it. Below xl both sidebars leave too little width for
                      // five, so there are fewer, wider columns.
                      <div className="p-2 md:p-3 grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] lg:grid-cols-3 xl:grid-cols-5" data-testid="profession-grid">
                        {shown.map((profession) => {
                          const rank = popularRank.get(profession._id);
                          const iconMissing = iconStateOf(professionIconUrl(profession.name, profession.updatedAt)) === 'missing';
                          const use = usage?.professions[profession._id];
                          const override = profession.serviceClass != null;
                          // The flags the tile only marks, spelt out in its tooltip. (Its counts
                          // are spelt out by the tile itself on hover.)
                          const details = [
                            profession.name,
                            iconMissing ? 'No icon in the app' : '',
                            rank ? `#${rank} under Popular Categories` : '',
                            override ? `${className(profession.serviceClass)} (its own setting)` : '',
                          ].filter(Boolean).join('\n');
                          return (
                            <button
                              key={profession._id}
                              type="button"
                              onClick={() => openProfession(category, profession)}
                              title={details}
                              className="group flex items-center gap-2.5 rounded-lg border border-gray-100 pl-2.5 pr-3 py-2.5 text-left hover:border-blue-200 hover:bg-blue-50/40 focus-visible:border-blue-300 focus-visible:outline-none transition-colors min-w-0"
                              data-testid="profession-tile"
                            >
                              <ProfessionIcon name={profession.name} updatedAt={profession.updatedAt} size="md" />
                              {/* Both faces share one grid cell, so the tile keeps its size as they swap. */}
                              <span className="min-w-0 flex-1 grid">
                                <span className="[grid-area:1/1] min-w-0 transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0" data-testid="profession-tile-face">
                                  <span className="line-clamp-2 break-words text-xs 2xl:text-sm font-semibold leading-tight text-gray-900">{profession.name}</span>
                                  <span className="mt-1 flex items-center gap-2.5 text-[11px] font-medium tabular-nums" data-testid="profession-tile-meta">
                                    <span className={`inline-flex items-center gap-0.5 ${use && !use.providers ? 'text-amber-700' : 'text-gray-500'}`} data-testid="profession-tile-providers">
                                      <Users className="h-3 w-3" aria-hidden="true" />
                                      {use ? use.providers : '–'}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 text-gray-500" data-testid="profession-tile-jobs">
                                      <Briefcase className="h-3 w-3" aria-hidden="true" />
                                      {use ? use.jobs : '–'}
                                    </span>
                                    <span className="ml-auto flex items-center gap-1">
                                      {rank && (
                                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-600" title={`#${rank} under Popular Categories on the home screen`}>
                                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                                          {rank}
                                        </span>
                                      )}
                                      {/* Only overrides are marked: badging the inheriting majority would bury them. */}
                                      {override && <ServiceClassBadge value={profession.serviceClass} iconOnly />}
                                    </span>
                                  </span>
                                </span>
                                {/* On hover (or keyboard focus): the counts, in words. */}
                                <span
                                  className="[grid-area:1/1] min-w-0 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                                  aria-hidden="true"
                                  data-testid="profession-tile-hover"
                                >
                                  {use ? (
                                    <>
                                      <span className={`block text-xs 2xl:text-sm font-semibold leading-tight truncate ${use.providers ? 'text-gray-900' : 'text-amber-700'}`}>
                                        {use.providers ? providersText(use.providers) : 'No providers yet'}
                                      </span>
                                      <span className="mt-1 block text-[11px] font-medium text-gray-500 truncate">
                                        {use.jobs ? jobsText(use.jobs) : 'No jobs yet'}
                                        {use.activeJobs ? ` · ${use.activeJobs} active` : ''}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="block text-xs text-gray-400">Counting…</span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <CategoryPanel
        open={categoryPanel === 'new' || Boolean(panelCategory)}
        category={panelCategory}
        usage={usage}
        popularRank={popularRank}
        covered={professionOpen && Boolean(professionPanel?.nested)}
        onClose={() => setCategoryPanel(null)}
        onSaved={refresh}
        onOpenProfession={(category, profession) => openProfession(category, profession, true)}
      />
      {professionCategory && (
        <ProfessionPanel
          open={professionOpen}
          category={professionCategory}
          profession={panelProfession}
          categories={sorted}
          usage={panelProfession ? usage?.professions[panelProfession._id] : undefined}
          popularRank={panelProfession ? popularRank.get(panelProfession._id) ?? null : null}
          layer={professionPanel?.nested && categoryPanel ? 1 : 0}
          onClose={() => setProfessionPanel(null)}
          onSaved={refresh}
          onManagePopular={openPopular}
        />
      )}
      <PopularCategoriesPanel open={popularOpen} categories={sorted} onClose={() => setPopularOpen(false)} onSaved={refresh} />
    </div>
  );
};

export default JobCategoryConfiguration;
