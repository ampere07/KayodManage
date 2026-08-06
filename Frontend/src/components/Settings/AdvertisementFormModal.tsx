import React, { useEffect, useState } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Gift, Tag, Type, MousePointerClick, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Advertisement,
  AdvertisementInput,
  AdvertisementType,
  AdOverlay,
  AdOverlayKind,
  AdOverlayPosition,
} from '../../types/configuration.types';
import { advertisementsService } from '../../services/advertisementsService';
import { useAdvertisementMutations } from '../../hooks/useAdvertisements';
import AdBanner from './AdBanner';

const POSITIONS: AdOverlayPosition[] = ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'];
const POSITION_LABELS: Record<AdOverlayPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  center: 'Center',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

const genOverlayId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  advertisement: Advertisement | null;
}

const emptyForm: AdvertisementInput = {
  type: 'offer',
  title: '',
  subtitle: '',
  highlight: '',
  ctaLabel: '',
  imageUrl: '',
  imageFileId: '',
  overlays: [],
  isActive: true,
};

const VARIANTS: { id: AdvertisementType; label: string; icon: any; hint: string }[] = [
  { id: 'invite', label: 'Invite', icon: Gift, hint: 'Referral · teal' },
  { id: 'offer', label: 'Offer', icon: Tag, hint: 'Discount · peach' },
  { id: 'image', label: 'Image', icon: ImageIcon, hint: 'Uploaded banner' },
];

const AdvertisementFormModal: React.FC<Props> = ({ isOpen, onClose, advertisement }) => {
  const { createAdvertisement, updateAdvertisement } = useAdvertisementMutations();
  const [form, setForm] = useState<AdvertisementInput>(emptyForm);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(advertisement ? { ...emptyForm, ...advertisement } : emptyForm);
  }, [isOpen, advertisement]);

  if (!isOpen) return null;

  const set = <K extends keyof AdvertisementInput>(key: K, value: AdvertisementInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addOverlay = (kind: AdOverlayKind) => {
    const overlay: AdOverlay = {
      id: genOverlayId(),
      kind,
      text: kind === 'button' ? 'Shop now' : 'Your text',
      color: '#FFFFFF',
      bgColor: kind === 'button' ? '#E37F0D' : undefined,
      position: kind === 'button' ? 'bottom-left' : 'top-left',
    };
    setForm((f) => ({ ...f, overlays: [...(f.overlays || []), overlay] }));
  };

  const updateOverlay = (id: string | undefined, patch: Partial<AdOverlay>) =>
    setForm((f) => ({
      ...f,
      overlays: (f.overlays || []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));

  const removeOverlay = (id: string | undefined) =>
    setForm((f) => ({ ...f, overlays: (f.overlays || []).filter((o) => o.id !== id) }));

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await advertisementsService.uploadAdvertisementImage(file, form.title || 'ad');
      setForm((f) => ({ ...f, type: 'image', imageUrl: res.url, imageFileId: res.fileId }));
    } catch {
      // apiClient surfaces the error toast
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = () => {
    if (form.type === 'image' && !form.imageUrl) {
      toast.error('Upload an image for this ad first');
      return;
    }
    if (form.type !== 'image' && !form.title?.trim()) {
      toast.error('Enter a title for the ad');
      return;
    }
    if (advertisement) {
      updateAdvertisement.mutate({ id: advertisement._id, data: form }, { onSuccess: onClose });
    } else {
      createAdvertisement.mutate(form, { onSuccess: onClose });
    }
  };

  const saving = createAdvertisement.isPending || updateAdvertisement.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {advertisement ? 'Edit advertisement' : 'Add advertisement'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Live preview */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Live preview</p>
            <div className="h-40 w-full">
              <AdBanner ad={form} />
            </div>
          </div>

          {/* Variant selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Banner style</label>
            <div className="grid grid-cols-3 gap-2">
              {VARIANTS.map((opt) => {
                const active = form.type === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set('type', opt.id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                      active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-800'}`}>{opt.label}</span>
                    <span className="text-[10px] text-gray-400">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {form.type === 'image' ? (
            /* Image upload + overlays */
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Ad image</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={uploading} />
                </label>
                <p className="mt-1 text-xs text-gray-400">Wide banner image (shown full-bleed in the carousel).</p>
              </div>

              {/* Overlays: text & buttons placed on the image */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Text &amp; buttons</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addOverlay('text')}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Type className="h-3.5 w-3.5" /> Text
                    </button>
                    <button
                      type="button"
                      onClick={() => addOverlay('button')}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <MousePointerClick className="h-3.5 w-3.5" /> Button
                    </button>
                  </div>
                </div>
                {(form.overlays || []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
                    No text or buttons yet — add text or a button to overlay on the image.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(form.overlays || []).map((ov) => (
                      <div key={ov.id} className="rounded-lg border border-gray-200 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                            {ov.kind}
                          </span>
                          <input
                            type="text"
                            value={ov.text}
                            onChange={(e) => updateOverlay(ov.id, { text: e.target.value })}
                            placeholder={ov.kind === 'button' ? 'Shop now' : 'Your text'}
                            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeOverlay(ov.id)}
                            title="Remove"
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            value={ov.position}
                            onChange={(e) => updateOverlay(ov.id, { position: e.target.value as AdOverlayPosition })}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700"
                          >
                            {POSITIONS.map((p) => (
                              <option key={p} value={p}>
                                {POSITION_LABELS[p]}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-xs text-gray-500">
                            Text
                            <input
                              type="color"
                              value={ov.color}
                              onChange={(e) => updateOverlay(ov.id, { color: e.target.value })}
                              className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
                            />
                          </label>
                          {ov.kind === 'button' && (
                            <label className="flex items-center gap-1 text-xs text-gray-500">
                              Fill
                              <input
                                type="color"
                                value={ov.bgColor || '#E37F0D'}
                                onChange={(e) => updateOverlay(ov.id, { bgColor: e.target.value })}
                                className="h-6 w-8 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : form.type === 'invite' ? (
            /* Invite banner fields */
            <>
              <Field label="Title (line 1)">
                <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Invite a Friend," />
              </Field>
              <Field label="Title (line 2)">
                <TextInput value={form.highlight} onChange={(v) => set('highlight', v)} placeholder="Get ₱50 off" />
              </Field>
              <Field label="Button label">
                <TextInput value={form.ctaLabel} onChange={(v) => set('ctaLabel', v)} placeholder="Refer Now" />
              </Field>
            </>
          ) : (
            /* Offer banner fields */
            <>
              <Field label="Title">
                <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Special Offer" />
              </Field>
              <Field label="Description">
                <TextInput value={form.subtitle} onChange={(v) => set('subtitle', v)} placeholder="Get amazing deals · use SAVE50" />
              </Field>
              <Field label="Discount">
                <TextInput value={form.highlight} onChange={(v) => set('highlight', v)} placeholder="20% off" />
              </Field>
              <Field label="Button label">
                <TextInput value={form.ctaLabel} onChange={(v) => set('ctaLabel', v)} placeholder="Post a Job" />
              </Field>
            </>
          )}

          {/* Active toggle */}
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Active</p>
              <p className="text-xs text-gray-400">Inactive ads are hidden from the client app.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!form.isActive}
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                form.isActive ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {advertisement ? 'Save changes' : 'Add ad'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
    {children}
  </div>
);

const TextInput: React.FC<{ value?: string; onChange: (v: string) => void; placeholder?: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <input
    type="text"
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
  />
);

export default AdvertisementFormModal;
