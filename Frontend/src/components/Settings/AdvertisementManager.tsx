import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  CornerUpRight,
  ExternalLink,
  GripVertical,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useAdvertisements, useAdvertisementMutations } from '../../hooks/useAdvertisements';
import type { AdPlacement, AdState, Advertisement } from '../../types/configuration.types';
import CounterGroups, { type Counter, type CounterGroup } from '../UI/CounterGroups';
import ConfirmDialog from '../UI/ConfirmDialog';
import FormPanel, { secondaryButton } from '../UI/FormPanel';
import AdBanner from './AdBanner';
import AdvertisementPanel from './ads/AdvertisementPanel';
import AdPhonePreview from './ads/AdPhonePreview';
import { PerformanceCell } from './ads/AdPerformance';
import { AD_DESTINATION_LABELS, isExternalLink } from '../../constants/adDestinations';
import {
  PLACEMENTS,
  PLACEMENT_META,
  STATE_META,
  STATE_ORDER,
  adName,
  count,
  isShowingIn,
  nextScheduledChange,
  placementsOf,
  stateDetail,
  stateOf,
  typeLabelOf,
  when,
} from '../../constants/advertisements';

/**
 * Settings → Configuration → Advertisement.
 *
 * The list-page standard (CounterGroups that double as filters, a search bar,
 * fixed-height rows), with the app's carousels previewed beside it. Every ad
 * opens in a side panel (ads/AdvertisementPanel) to design it, pick where a
 * tap goes, aim it at the client and/or provider home, schedule it, and read
 * how it did.
 */

type Filter = 'all' | AdState | AdPlacement;

/**
 * Row columns. The page sits beside two sidebars, so the list is narrow: below
 * xl a row stacks; from xl it's a table; "Shows on" gets its own column from
 * 2xl (below that it rides on the destination line).
 */
const ROW_GRID =
  'xl:grid-cols-[1.25rem_7rem_minmax(0,1fr)_8.25rem_7rem_6.5rem] 2xl:grid-cols-[1.25rem_7rem_minmax(0,1fr)_8.75rem_6.5rem_7.5rem_6.5rem]';

/** Room for the phone preview beside the list (both sidebars + a usable list). */
const WIDE_QUERY = '(min-width: 1880px)';
function useWideScreen() {
  const read = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE_QUERY).matches : true);
  const [wide, setWide] = useState(read);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return wide;
}

const matchesFilter = (ad: Advertisement, filter: Filter, now: Date) =>
  filter === 'all'
    ? true
    : (PLACEMENTS as string[]).includes(filter)
      ? placementsOf(ad).includes(filter as AdPlacement)
      : stateOf(ad, now) === filter;

const destinationText = (linkAction?: string) => {
  if (!linkAction) return 'Opens the banner’s default screen';
  return isExternalLink(linkAction) ? `Opens ${linkAction}` : `Opens ${AD_DESTINATION_LABELS[linkAction] || linkAction}`;
};

const searchText = (ad: Advertisement) =>
  [ad.title, ad.subtitle, ad.highlight, ad.ctaLabel, typeLabelOf(ad.type), destinationText(ad.linkAction)].join(' ').toLowerCase();

const AdvertisementManager: React.FC = () => {
  const { advertisements, isLoading } = useAdvertisements();
  const { updateAdvertisement, deleteAdvertisement, reorderAdvertisements, duplicateAdvertisement } = useAdvertisementMutations();

  const [panel, setPanel] = useState<{ ad: Advertisement | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advertisement | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [previewPlacement, setPreviewPlacement] = useState<AdPlacement>('client_home');
  const [previewOpen, setPreviewOpen] = useState(false);
  const wide = useWideScreen();
  // Re-read the clock every minute, so a scheduled start or end flips the
  // states (and the preview) without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Local copy so a drag reorders instantly; the server list is the source of
  // truth whenever we aren't mid-drag.
  const [items, setItems] = useState<Advertisement[]>(advertisements);
  const [dragId, setDragId] = useState<string | null>(null);
  const draggingRef = useRef(false);
  useEffect(() => {
    if (!draggingRef.current) setItems(advertisements);
  }, [advertisements]);

  // A panel follows its ad through refetches (e.g. after a duplicate or save).
  const panelAd = panel?.ad ? items.find((a) => a._id === panel.ad!._id) || panel.ad : null;

  const searched = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? items.filter((ad) => searchText(ad).includes(s)) : items;
  }, [items, search]);
  const visible = searched.filter((ad) => matchesFilter(ad, filter, now));
  const countOf = (f: Filter) => searched.filter((ad) => matchesFilter(ad, f, now)).length;

  // Reordering writes the whole sequence, so it is only offered on the full list.
  const canReorder = filter === 'all' && !search.trim() && items.length > 1;

  const choose = (f: Filter) => setFilter((current) => (current === f ? 'all' : f));
  const cell = (key: Exclude<Filter, 'all'>, label: string, tone: Counter['tone'], hint: string, extra: Partial<Counter> = {}): Counter => ({
    key,
    label,
    tone,
    hint,
    count: isLoading ? undefined : countOf(key),
    selected: filter === key,
    onClick: () => choose(key),
    ...extra,
  });
  const groups: CounterGroup[] = [
    {
      label: 'Status',
      cells: STATE_ORDER.map((s) => cell(s, s === 'draft' ? 'Drafts' : STATE_META[s].label, STATE_META[s].tone, STATE_META[s].help)),
    },
    {
      label: 'Shows on',
      // "Shows on · Clients / Providers": the short form, so seven cells fit at 1280.
      cells: PLACEMENTS.map((p) => cell(p, PLACEMENT_META[p].short, PLACEMENT_META[p].tone, `${PLACEMENT_META[p].label}: ${PLACEMENT_META[p].where}`)),
    },
  ];

  const showingNow = (p: AdPlacement) => items.filter((ad) => isShowingIn(ad, p, now));
  const previewAds = showingNow(previewPlacement);
  const next = nextScheduledChange(items, now);
  const views14 = items.reduce((n, ad) => n + (ad.stats?.daily || []).reduce((m, d) => m + d.views, 0), 0);
  const taps14 = items.reduce((n, ad) => n + (ad.stats?.daily || []).reduce((m, d) => m + d.taps, 0), 0);

  const previewBody = (
    <>
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Smartphone className="h-4 w-4 text-gray-400" />
          In the app now
        </h3>
        <div className="mt-2 flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold" role="tablist">
          {PLACEMENTS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={previewPlacement === p}
              onClick={() => setPreviewPlacement(p)}
              className={`flex-1 rounded-md px-2 py-1.5 ${previewPlacement === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              data-testid={`ads-preview-${p}`}
            >
              {PLACEMENT_META[p].label} <span className={previewPlacement === p ? 'text-white/70' : 'text-gray-400'}>{showingNow(p).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <AdPhonePreview placement={previewPlacement} ads={previewAds.map((ad) => ({ ...ad, key: ad._id }))} />
        <p className="mt-3 text-center text-[11px] text-gray-500" data-testid="ads-next-change">
          {next
            ? `Next change: “${adName(next.ad)}” ${next.kind === 'starts' ? 'goes live' : 'comes down'} ${when(next.at, now)}.`
            : 'Nothing is scheduled to start or end.'}
        </p>
      </div>
    </>
  );

  const setStatus = (ad: Advertisement, status: 'published' | 'paused') =>
    updateAdvertisement.mutate({
      id: ad._id,
      data: { status },
      successMessage:
        status === 'paused'
          ? 'Paused — it is out of the app'
          : stateOf({ ...ad, status, isActive: true }, new Date()) === 'scheduled'
            ? `Scheduled — it goes live ${when(ad.startsAt as string)}`
            : 'Published — it is in the app now',
    });

  // Drag & drop
  const handleDragEnter = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setItems((current) => {
      const from = current.findIndex((a) => a._id === dragId);
      const to = current.findIndex((a) => a._id === overId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const handleDragEnd = () => {
    draggingRef.current = false;
    setDragId(null);
    const nextIds = items.map((a) => a._id);
    if (nextIds.some((id, i) => id !== advertisements[i]?._id)) reorderAdvertisements.mutate(nextIds);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 pt-4">
          <p className="text-xs text-gray-500 font-medium mb-3" data-testid="ads-summary">
            {isLoading
              ? 'Banners in the Kayod app’s home-screen carousels'
              : `${items.length} ad${items.length === 1 ? '' : 's'} · showing now: ${showingNow('client_home').length} on the client home, ${showingNow('provider_home').length} on the provider home · ${count(views14)} views and ${count(taps14)} taps in 14 days`}
          </p>
          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.8fr_6.6fr_2.6fr]"
            all={{ count: isLoading ? undefined : searched.length, selected: filter === 'all', onClick: () => setFilter('all') }}
            filtered={filter !== 'all' || Boolean(search)}
            onClear={() => { setFilter('all'); setSearch(''); }}
            testId="ads-counters"
            idPrefix="ads"
            allCell={{ label: 'All', hint: 'Every ad under the search' }}
          />
        </div>
        <div className="px-4 md:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 lg:h-4 lg:w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ads by their text or destination..."
              className="w-full pl-8 pr-3 h-8 lg:h-9 lg:pl-10 bg-white border border-gray-200 rounded-lg lg:rounded-xl text-xs lg:text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              data-testid="ads-search"
            />
          </div>
          {/* Beside the list only on very wide screens; otherwise in a drawer. */}
          {!wide && <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-8 lg:h-9 px-3 rounded-lg lg:rounded-xl border border-gray-200 bg-white text-xs lg:text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
            data-testid="ads-preview-open"
          >
            <Smartphone className="h-4 w-4 text-gray-500" />
            Preview app
          </button>}
          <button
            type="button"
            onClick={() => setPanel({ ad: null })}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-8 lg:h-9 px-3 rounded-lg lg:rounded-xl bg-blue-600 text-xs lg:text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
            data-testid="ads-new"
          >
            <Plus className="h-4 w-4" />
            New advertisement
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className={`p-3 md:p-6 grid gap-4 ${wide ? 'grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          {/* The list */}
          <div className="min-w-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center" data-testid="ads-empty">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Megaphone className="h-6 w-6" /></div>
                <p className="mt-4 text-gray-700 font-semibold">No advertisements yet</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">Promote an offer, a referral bonus or your own artwork on the client and provider home screens.</p>
                <button type="button" onClick={() => setPanel({ ad: null })} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">Create an advertisement</button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center" data-testid="ads-nothing-matches">
                <p className="text-gray-700 font-semibold">Nothing matches</p>
                <p className="text-sm text-gray-500 mt-1">Try another search, or clear the filters.</p>
                <button type="button" onClick={() => { setFilter('all'); setSearch(''); }} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">Show everything</button>
              </div>
            ) : (
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm" data-testid="ads-list">
                {/* No overflow-hidden on the card: it would clip the row menus near the bottom. */}
                <div className={`hidden xl:grid ${ROW_GRID} items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 rounded-t-xl text-[10px] font-black uppercase tracking-wider text-gray-500`}>
                  <span />
                  <span>Banner</span>
                  <span>Advertisement</span>
                  <span>Status</span>
                  <span className="hidden 2xl:block">Shows on</span>
                  <span>Performance</span>
                  <span />
                </div>
                <ul className="divide-y divide-gray-100">
                  {visible.map((ad) => (
                    <AdRow
                      key={ad._id}
                      ad={ad}
                      now={now}
                      position={items.findIndex((a) => a._id === ad._id) + 1}
                      canReorder={canReorder}
                      isDragging={dragId === ad._id}
                      onDragStart={() => { draggingRef.current = true; setDragId(ad._id); }}
                      onDragEnter={() => handleDragEnter(ad._id)}
                      onDragEnd={handleDragEnd}
                      onEdit={() => setPanel({ ad })}
                      onPublish={() => setStatus(ad, 'published')}
                      onPause={() => setStatus(ad, 'paused')}
                      onDuplicate={() => duplicateAdvertisement.mutate(ad._id)}
                      onDelete={() => setPendingDelete(ad)}
                    />
                  ))}
                </ul>
                <p className="px-4 py-2.5 border-t border-gray-100 text-[11px] text-gray-500">
                  {canReorder
                    ? 'Drag the handle to change the order ads take in each carousel.'
                    : items.length > 1
                      ? 'Clear the search and filters to reorder.'
                      : 'Add another ad to set an order.'}
                </p>
              </section>
            )}
          </div>

          {/* The app, as it is now — beside the list when there's room. */}
          {wide && (
            <aside className="self-start sticky top-0">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="ads-preview">
                {previewBody}
              </div>
            </aside>
          )}
        </div>
      </div>

      {!wide && (
        <FormPanel
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onSubmit={(e) => e.preventDefault()}
          testId="ads-preview-drawer"
          header={<h2 className="text-lg font-bold text-gray-900">Preview the app</h2>}
          footer={<div className="flex justify-end"><button type="button" className={secondaryButton} onClick={() => setPreviewOpen(false)}>Close</button></div>}
        >
          {previewBody}
        </FormPanel>
      )}

      <AdvertisementPanel open={Boolean(panel)} advertisement={panelAd} onClose={() => setPanel(null)} />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete this advertisement?"
        message={
          <>
            <span className="font-medium text-gray-700">{pendingDelete ? adName(pendingDelete) : ''}</span> leaves the app and its view and tap
            counts are deleted; its image goes too unless a copy still uses it. Pause it instead to only hide it.
          </>
        }
        confirmLabel="Delete permanently"
        isLoading={deleteAdvertisement.isPending}
        onConfirm={() => pendingDelete && deleteAdvertisement.mutate(pendingDelete._id, { onSuccess: () => setPendingDelete(null) })}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

// --- Rows ---------------------------------------------------------------------

/** The real AdBanner, scaled down, so the list shows what ships. */
const THUMB_W = 112;
const THUMB_H = 62;
const BANNER_W = 264;
const SCALE = THUMB_W / BANNER_W;

const Thumbnail: React.FC<{ ad: Advertisement; dimmed?: boolean }> = ({ ad, dimmed }) => (
  <div className={`relative flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200 ${dimmed ? 'opacity-60' : ''}`} style={{ width: THUMB_W, height: THUMB_H }} aria-hidden data-testid="ad-row-thumb">
    <div style={{ width: BANNER_W, height: THUMB_H / SCALE, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
      <AdBanner ad={ad} />
    </div>
  </div>
);

const StateBadge: React.FC<{ state: AdState }> = ({ state }) => {
  const meta = STATE_META[state];
  return (
    <span title={meta.help} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${meta.badge}`} data-testid="ad-row-state">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

const RowMenu: React.FC<{ items: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void; danger?: boolean; testId: string }[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="More actions" aria-expanded={open} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" data-testid="ad-row-more">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg" role="menu">
          {items.map(({ label, icon: Icon, onClick, danger, testId }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
              data-testid={testId}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AdRow: React.FC<{
  ad: Advertisement;
  now: Date;
  position: number;
  canReorder: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onPause: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({ ad, now, position, canReorder, isDragging, onDragStart, onDragEnter, onDragEnd, onEdit, onPublish, onPause, onDuplicate, onDelete }) => {
  const [grabbed, setGrabbed] = useState(false);
  const state = stateOf(ad, now);
  const places = placementsOf(ad);
  const placesText = places.map((p) => PLACEMENT_META[p].label).join(' & ');
  const external = isExternalLink(ad.linkAction);
  // Live and scheduled ads can be paused; so can an ended one, to take it out
  // of the published list. Drafts and paused ads can be published.
  const toggle = state === 'draft' || state === 'paused'
    ? { label: 'Publish', icon: Play, onClick: onPublish, testId: 'ad-row-publish' }
    : { label: 'Pause', icon: Pause, onClick: onPause, testId: 'ad-row-pause' };

  return (
    <li
      draggable={grabbed}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => { setGrabbed(false); onDragEnd(); }}
      className={`group grid grid-cols-[auto_minmax(0,1fr)] ${ROW_GRID} items-center gap-x-3 gap-y-2 px-3 xl:px-4 py-3 xl:h-[88px] transition-colors ${isDragging ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}
      data-testid="ad-row"
    >
      <button
        type="button"
        aria-label={canReorder ? `Drag to reorder (position ${position})` : 'Reordering needs the full, unfiltered list'}
        title={canReorder ? 'Drag to reorder' : 'Clear the search and filters to reorder'}
        disabled={!canReorder}
        onMouseDown={() => canReorder && setGrabbed(true)}
        onMouseUp={() => setGrabbed(false)}
        className="hidden xl:flex items-center justify-center cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button type="button" onClick={onEdit} className="row-span-2 xl:row-span-1 self-start xl:self-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" aria-label={`Edit ${adName(ad)}`}>
        <Thumbnail ad={ad} dimmed={state !== 'live'} />
      </button>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 truncate">{typeLabelOf(ad.type)} · #{position}</p>
        <button type="button" onClick={onEdit} className="block max-w-full text-left text-sm font-bold text-gray-900 truncate hover:text-blue-700" data-testid="ad-row-name">
          {adName(ad)}
        </button>
        <p className="flex items-center gap-1 text-[11px] text-gray-500 min-w-0" title={`${destinationText(ad.linkAction)} · ${placesText}`}>
          {external ? <ExternalLink className="h-3 w-3 flex-shrink-0" /> : <CornerUpRight className="h-3 w-3 flex-shrink-0" />}
          <span className="truncate">
            {destinationText(ad.linkAction)}
            {/* xl–2xl: no "Shows on" column yet, so it rides here. */}
            <span className="hidden xl:inline 2xl:hidden"> · {placesText}</span>
          </span>
        </p>
        {/* Below xl the other columns ride here. */}
        <div className="xl:hidden mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StateBadge state={state} />
          <span className="text-[11px] text-gray-500">{stateDetail(ad, now)}</span>
          <span className="text-[11px] text-gray-500">· {places.map((p) => PLACEMENT_META[p].short).join(' & ')}</span>
          {ad.stats && ad.stats.views + ad.stats.taps > 0 && (
            <span className="text-[11px] text-gray-500">· {count(ad.stats.views)} views, {count(ad.stats.taps)} taps</span>
          )}
        </div>
      </div>

      <div className="hidden xl:flex flex-col items-start gap-1.5 min-w-0">
        <StateBadge state={state} />
        <span className="text-[11px] text-gray-500 truncate max-w-full" data-testid="ad-row-state-detail">{stateDetail(ad, now)}</span>
      </div>

      <div className="hidden 2xl:block min-w-0" data-testid="ad-row-placements">
        {places.map((p) => (
          <p key={p} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700">
            <span className={`h-1.5 w-1.5 rounded-full ${p === 'client_home' ? 'bg-orange-500' : 'bg-indigo-500'}`} />
            {PLACEMENT_META[p].label}
          </p>
        ))}
      </div>

      <div className="hidden xl:block min-w-0">
        <PerformanceCell stats={ad.stats} />
      </div>

      <div className="col-start-2 xl:col-start-auto flex items-center justify-end gap-1">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50" data-testid="ad-row-edit">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <RowMenu
          items={[
            toggle,
            { label: 'Duplicate', icon: Copy, onClick: onDuplicate, testId: 'ad-row-duplicate' },
            { label: 'Delete', icon: Trash2, onClick: onDelete, danger: true, testId: 'ad-row-delete' },
          ]}
        />
      </div>
    </li>
  );
};

export default AdvertisementManager;
