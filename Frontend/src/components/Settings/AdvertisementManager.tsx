import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdvertisements, useAdvertisementMutations } from '../../hooks/useAdvertisements';
import { Advertisement } from '../../types/configuration.types';
import ClientHomePreview from './ClientHomePreview';
import AdvertisementFormModal from './AdvertisementFormModal';
import { KAYOD } from './AdBanner';

const AdvertisementManager: React.FC = () => {
  const { advertisements, isLoading } = useAdvertisements();
  const { updateAdvertisement, deleteAdvertisement } = useAdvertisementMutations();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  const openAdd = () => {
    setEditingAd(null);
    setModalOpen(true);
  };
  const openEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setModalOpen(true);
  };
  const handleDelete = (ad: Advertisement) => {
    if (window.confirm('Delete this advertisement? This cannot be undone.')) {
      deleteAdvertisement.mutate(ad._id);
    }
  };
  const toggleActive = (ad: Advertisement) =>
    updateAdvertisement.mutate({ id: ad._id, data: { isActive: !ad.isActive } });

  const activeAds = advertisements.filter((a) => a.isActive);

  return (
    <div className="bg-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Advertisement</h2>
          <p className="mt-1 max-w-lg text-sm text-gray-500">
            Manage the ads shown in the Kayod client home screen promo carousel. Add styled
            container ads or upload image banners — the preview updates live.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add ad</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
        {/* List */}
        <div>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : advertisements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-14 text-center">
              <p className="mb-1 text-sm font-medium text-gray-700">No advertisements yet</p>
              <p className="mb-4 text-sm text-gray-400">Add your first ad to show it on the client home screen.</p>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Add ad
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {advertisements.map((ad) => (
                <AdRow
                  key={ad._id}
                  ad={ad}
                  onEdit={() => openEdit(ad)}
                  onDelete={() => handleDelete(ad)}
                  onToggle={() => toggleActive(ad)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="self-start lg:sticky lg:top-4">
          <ClientHomePreview ads={activeAds} showIntro={false} />
        </div>
      </div>

      <AdvertisementFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        advertisement={editingAd}
      />
    </div>
  );
};

const AdThumb: React.FC<{ ad: Advertisement }> = ({ ad }) => {
  if (ad.type === 'image' && ad.imageUrl) {
    return <img src={ad.imageUrl} alt={ad.title || 'Ad'} className="h-14 w-20 flex-shrink-0 rounded-lg object-cover" />;
  }
  const isInvite = ad.type === 'invite';
  return (
    <div
      className="flex h-14 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg p-1 text-center text-[8px] font-bold leading-tight"
      style={{
        backgroundColor: isInvite ? KAYOD.inviteTeal : KAYOD.primaryLight,
        color: isInvite ? '#FFFFFF' : KAYOD.primary,
      }}
    >
      <span className="line-clamp-3">{ad.title || (isInvite ? 'Invite banner' : 'Offer banner')}</span>
    </div>
  );
};

const AdRow: React.FC<{
  ad: Advertisement;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}> = ({ ad, onEdit, onDelete, onToggle }) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
    <AdThumb ad={ad} />

    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-gray-900">
        {ad.type === 'image' ? ad.title || 'Image ad' : ad.title || 'Untitled ad'}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {ad.type}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            ad.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {ad.isActive ? 'Active' : 'Hidden'}
        </span>
      </div>
    </div>

    {/* Active toggle */}
    <button
      type="button"
      role="switch"
      aria-checked={ad.isActive}
      onClick={onToggle}
      title={ad.isActive ? 'Hide from app' : 'Show in app'}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        ad.isActive ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ad.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>

    <button onClick={onEdit} title="Edit" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600">
      <Pencil className="h-4 w-4" />
    </button>
    <button onClick={onDelete} title="Delete" className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
      <Trash2 className="h-4 w-4" />
    </button>
  </div>
);

export default AdvertisementManager;
