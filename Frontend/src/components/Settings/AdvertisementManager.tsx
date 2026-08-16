import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ExternalLink,
  CornerUpRight,
  Play,
  Pause,
  Megaphone,
  Smartphone,
  Info,
} from 'lucide-react';
import { useAdvertisements, useAdvertisementMutations } from '../../hooks/useAdvertisements';
import { AdStatus, Advertisement } from '../../types/configuration.types';
import ClientHomePreview from './ClientHomePreview';
import AdvertisementFormModal from './AdvertisementFormModal';
import ConfirmDialog from '../UI/ConfirmDialog';
import AdBanner from './AdBanner';
import { AD_DESTINATION_LABELS, isExternalLink } from '../../constants/adDestinations';
import {
  STATUS_META,
  adName,
  statusOf,
  typeIconOf,
  typeLabelOf,
} from '../../constants/advertisements';

type FilterId = 'all' | AdStatus;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Live' },
  { id: 'paused', label: 'Paused' },
  { id: 'draft', label: 'Drafts' },
];

const AdvertisementManager: React.FC = () => {
  const { advertisements, isLoading } = useAdvertisements();
  const { updateAdvertisement, deleteAdvertisement, reorderAdvertisements } =
    useAdvertisementMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advertisement | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');

  // Local copy so a drag reorders instantly; the server list is the source of
  // truth whenever we aren't mid-drag.
  const [items, setItems] = useState<Advertisement[]>(advertisements);
  const [dragId, setDragId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setItems(advertisements);
  }, [advertisements]);

  const openAdd = () => {
    setEditingAd(null);
    setModalOpen(true);
  };
  const openEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setModalOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteAdvertisement.mutate(pendingDelete._id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  const setStatus = (ad: Advertisement, status: AdStatus) =>
    updateAdvertisement.mutate({
      id: ad._id,
      data: { status },
      successMessage:
        status === 'published' ? 'Advertisement published' : 'Advertisement paused',
    });

  // --- Drag & drop ---------------------------------------------------------
  // Reordering writes the whole sequence, so it is only offered on the
  // unfiltered list — dragging within a subset could not express the rest.
  const canReorder = filter === 'all' && items.length > 1;

  const handleDragStart = (id: string) => {
    draggingRef.current = true;
    setDragId(id);
  };

  // Reorder live as the pointer passes over a neighbour.
  const handleDragEnterRow = (overId: string) => {
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
    const currentIds = advertisements.map((a) => a._id);
    const changed = nextIds.some((id, i) => id !== currentIds[i]);
    if (changed) reorderAdvertisements.mutate(nextIds);
  };

  // --- Derived -------------------------------------------------------------
  const counts = useMemo(() => {
    const base: Record<FilterId, number> = {
      all: items.length,
      published: 0,
      paused: 0,
      draft: 0,
    };
    items.forEach((ad) => {
      base[statusOf(ad)] += 1;
    });
    return base;
  }, [items]);

  const liveAds = useMemo(() => items.filter((ad) => statusOf(ad) === 'published'), [items]);

  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((ad) => statusOf(ad) === filter)),
    [items, filter],
  );

  // Carousel position counts only live ads — the others aren't in the carousel.
  const slotByAdId = useMemo(() => {
    const map = new Map<string, number>();
    let slot = 0;
    items.forEach((ad) => {
      if (statusOf(ad) === 'published') map.set(ad._id, ++slot);
    });
    return map;
  }, [items]);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-[1500px] p-4 md:p-6">
        {/* Page header — the tab header above already names the section, so
            this row only sets context and offers the primary action. */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-gray-500">
            Banners in the promo carousel on the Kayod app home screen. Create one, fill in the
            details, check the preview, then publish it.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New advertisement
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
          {/* Manage column ------------------------------------------------ */}
          <div className="min-w-0">
            {isLoading ? (
              <ListSkeleton />
            ) : items.length === 0 ? (
              <EmptyState onAdd={openAdd} />
            ) : (
              <>
                {/* Filters + reorder hint. Stacked rather than justified: the
                    list column stays narrow even on a wide screen. */}
                <div className="mb-4 space-y-2">
                  <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
                    {FILTERS.map((f) => {
                      const active = filter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          {f.label}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                              active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {counts[f.id]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* The drag handle is desktop-only, so is its hint. */}
                  <p className="hidden items-center gap-1.5 text-xs text-gray-500 sm:flex">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                    {canReorder
                      ? 'Drag the handle to change the carousel order'
                      : filter !== 'all'
                        ? 'Switch to “All” to reorder the carousel'
                        : 'Add another ad to start ordering the carousel'}
                  </p>
                </div>

                {/* Ad cards */}
                {visibleItems.length === 0 ? (
                  <FilteredEmptyState filter={filter} onShowAll={() => setFilter('all')} />
                ) : (
                  <div className="space-y-3">
                    {visibleItems.map((ad) => (
                      <AdCard
                        key={ad._id}
                        ad={ad}
                        slot={slotByAdId.get(ad._id)}
                        canReorder={canReorder}
                        isDragging={dragId === ad._id}
                        onDragStart={() => handleDragStart(ad._id)}
                        onDragEnter={() => handleDragEnterRow(ad._id)}
                        onDragEnd={handleDragEnd}
                        onEdit={() => openEdit(ad)}
                        onDelete={() => setPendingDelete(ad)}
                        onPublish={() => setStatus(ad, 'published')}
                        onPause={() => setStatus(ad, 'paused')}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Preview column ---------------------------------------------- */}
          <aside className="xl:w-[400px] xl:self-start">
            <div className="rounded-2xl border border-gray-200 bg-white xl:sticky xl:top-4">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Smartphone className="h-4 w-4 text-gray-400" />
                  App preview
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {liveAds.length > 0
                    ? `The client home screen with your ${liveAds.length} live ${
                        liveAds.length === 1 ? 'ad' : 'ads'
                      }.`
                    : 'No live ads yet — the carousel below shows sample content.'}
                </p>
              </div>
              <div className="p-4">
                <ClientHomePreview ads={liveAds} showIntro={false} padded={false} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AdvertisementFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        advertisement={editingAd}
      />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Delete this advertisement?"
        message={
          <>
            <span className="font-medium text-gray-700">
              {pendingDelete ? adName(pendingDelete) : ''}
            </span>{' '}
            will be removed from the app and its uploaded image deleted. This cannot be undone —
            pause it instead if you only want to hide it for now.
          </>
        }
        confirmLabel="Delete permanently"
        isLoading={deleteAdvertisement.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

// --- Cards --------------------------------------------------------------------

/**
 * A true-to-app miniature of the banner: the real AdBanner scaled down, so the
 * list shows exactly what will ship rather than a stand-in swatch.
 */
const AD_THUMB_W = 132;
const AD_THUMB_H = 84;
const AD_BANNER_W = 264; // width AdBanner's type scale is designed around
const AD_THUMB_SCALE = AD_THUMB_W / AD_BANNER_W;

const AdThumbnail: React.FC<{ ad: Advertisement; dimmed?: boolean }> = ({ ad, dimmed }) => (
  <div
    className={`relative flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200 transition-opacity ${
      dimmed ? 'opacity-60' : ''
    }`}
    style={{ width: AD_THUMB_W, height: AD_THUMB_H }}
    aria-hidden
  >
    <div
      style={{
        width: AD_BANNER_W,
        height: AD_THUMB_H / AD_THUMB_SCALE,
        transform: `scale(${AD_THUMB_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      <AdBanner ad={ad} />
    </div>
  </div>
);

const StatusChip: React.FC<{ status: AdStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  return (
    <span
      title={meta.help}
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

const DestinationChip: React.FC<{ linkAction?: string }> = ({ linkAction }) => {
  if (!linkAction) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
        No destination set
      </span>
    );
  }
  const external = isExternalLink(linkAction);
  return (
    <span
      title={external ? linkAction : `Opens ${AD_DESTINATION_LABELS[linkAction] || linkAction}`}
      className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-500"
    >
      {external ? (
        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      ) : (
        <CornerUpRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      )}
      <span className="truncate">
        Opens {external ? linkAction : AD_DESTINATION_LABELS[linkAction] || linkAction}
      </span>
    </span>
  );
};

const AdCard: React.FC<{
  ad: Advertisement;
  slot?: number;
  canReorder: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onPause: () => void;
}> = ({
  ad,
  slot,
  canReorder,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onEdit,
  onDelete,
  onPublish,
  onPause,
}) => {
  // Only a press on the grip arms the card for dragging, so the buttons inside
  // stay clickable.
  const [grabbed, setGrabbed] = useState(false);
  const status = statusOf(ad);
  const isLive = status === 'published';
  const TypeIcon = typeIconOf(ad.type);

  return (
    <article
      draggable={grabbed}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setGrabbed(false);
        onDragEnd();
      }}
      className={`rounded-2xl border bg-white p-3 transition-all sm:p-4 ${
        isDragging
          ? 'border-blue-400 opacity-70 shadow-lg ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          aria-label={canReorder ? 'Drag to reorder' : 'Reordering is available in the All view'}
          title={canReorder ? 'Drag to reorder' : 'Switch to “All” to reorder'}
          disabled={!canReorder}
          onMouseDown={() => canReorder && setGrabbed(true)}
          onMouseUp={() => setGrabbed(false)}
          className="mt-6 hidden flex-shrink-0 cursor-grab rounded-lg p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:block"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <AdThumbnail ad={ad} dimmed={!isLive} />

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">{adName(ad)}</h3>
            <StatusChip status={status} />
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
            <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <span>{typeLabelOf(ad.type)}</span>
            {isLive && slot ? (
              <>
                <span className="text-gray-300">·</span>
                <span>Position {slot} in the carousel</span>
              </>
            ) : null}
          </p>

          <div className="mt-1">
            <DestinationChip linkAction={ad.linkAction} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>

          {isLive ? (
            <button
              onClick={onPause}
              title="Hide this ad from the app without deleting it"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          ) : (
            <button
              onClick={onPublish}
              title="Show this ad in the app carousel"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Play className="h-3.5 w-3.5" />
              Publish
            </button>
          )}
        </div>

        <button
          onClick={onDelete}
          title="Delete this advertisement"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </article>
  );
};

// --- States -------------------------------------------------------------------

const ListSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex animate-pulse items-start gap-3">
          <div className="h-[84px] w-[132px] flex-shrink-0 rounded-xl bg-gray-100" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-1/3 rounded bg-gray-100" />
            <div className="h-3 w-1/4 rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <Megaphone className="h-6 w-6" />
    </div>
    <h3 className="mt-4 text-base font-semibold text-gray-900">No advertisements yet</h3>
    <p className="mt-1 max-w-sm text-sm text-gray-500">
      Create your first banner to promote an offer, a referral bonus, or your own artwork on the
      app home screen.
    </p>
    <button
      onClick={onAdd}
      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
    >
      <Plus className="h-4 w-4" />
      Create advertisement
    </button>
  </div>
);

const FilteredEmptyState: React.FC<{ filter: FilterId; onShowAll: () => void }> = ({
  filter,
  onShowAll,
}) => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
    <p className="text-sm font-medium text-gray-700">
      No {filter === 'all' ? '' : STATUS_META[filter as AdStatus].label.toLowerCase()}{' '}
      advertisements
    </p>
    <button
      onClick={onShowAll}
      className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
    >
      Show all advertisements
    </button>
  </div>
);

export default AdvertisementManager;
