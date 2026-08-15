import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Upload,
  Loader2,
  Type,
  MousePointerClick,
  Trash2,
  Check,
  AlertCircle,
  Send,
  Save,
  FileText,
} from 'lucide-react';
import {
  Advertisement,
  AdvertisementInput,
  AdvertisementType,
  AdOverlay,
  AdOverlayKind,
  AdOverlayPosition,
  AdStatus,
} from '../../types/configuration.types';
import { advertisementsService } from '../../services/advertisementsService';
import { useAdvertisementMutations } from '../../hooks/useAdvertisements';
import AdBanner from './AdBanner';
import ConfirmDialog from '../UI/ConfirmDialog';
import { STATUS_META, TYPE_META, statusOf } from '../../constants/advertisements';
import {
  AD_DESTINATIONS,
  AD_DESTINATION_GROUPS,
  AD_URL_SENTINEL,
  AD_LINK_MAX,
  isExternalLink,
  isValidHttpsUrl,
  normalizeAdUrl,
} from '../../constants/adDestinations';

// The five anchor points laid out as they sit on the banner, so picking one is
// a matter of pointing at the corner rather than reading a dropdown.
const POSITION_CELLS: (AdOverlayPosition | null)[] = [
  'top-left', null, 'top-right',
  null, 'center', null,
  'bottom-left', null, 'bottom-right',
];
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

// `status` is set by the footer buttons, not edited as a field, so it is kept
// out of the form state.
type AdForm = Omit<AdvertisementInput, 'status' | 'isActive' | 'order'>;

const emptyForm: AdForm = {
  type: 'offer',
  title: '',
  subtitle: '',
  highlight: '',
  ctaLabel: '',
  imageUrl: '',
  imageFileId: '',
  overlays: [],
  linkAction: '',
};

const toForm = (ad: Advertisement | null): AdForm =>
  ad
    ? {
        type: ad.type,
        title: ad.title || '',
        subtitle: ad.subtitle || '',
        highlight: ad.highlight || '',
        ctaLabel: ad.ctaLabel || '',
        imageUrl: ad.imageUrl || '',
        imageFileId: ad.imageFileId || '',
        overlays: ad.overlays || [],
        linkAction: ad.linkAction || '',
      }
    : emptyForm;

const LAYOUTS = (['offer', 'invite', 'image'] as AdvertisementType[]).map((id) => ({
  id,
  ...TYPE_META[id],
}));

type FormErrors = { title?: string; image?: string; link?: string };

const AdvertisementFormModal: React.FC<Props> = ({ isOpen, onClose, advertisement }) => {
  const { createAdvertisement, updateAdvertisement } = useAdvertisementMutations();
  const [form, setForm] = useState<AdForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Keeps "External link…" selected while its URL box is still empty.
  const [linkMode, setLinkMode] = useState<'route' | 'url'>('route');
  // Snapshot of the opening state, to tell an untouched form from an edited one.
  const baselineRef = useRef<string>('');

  const currentStatus: AdStatus | null = advertisement ? statusOf(advertisement) : null;

  useEffect(() => {
    if (!isOpen) return;
    const next = toForm(advertisement);
    setForm(next);
    setErrors({});
    setLinkMode(isExternalLink(next.linkAction) ? 'url' : 'route');
    baselineRef.current = JSON.stringify(next);
  }, [isOpen, advertisement]);

  const isDirty = useMemo(() => JSON.stringify(form) !== baselineRef.current, [form]);

  if (!isOpen) return null;

  const set = <K extends keyof AdForm>(key: K, value: AdForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear the message for the field being corrected, and leave the others.
    if (key === 'title') setErrors((e) => ({ ...e, title: undefined }));
    if (key === 'imageUrl') setErrors((e) => ({ ...e, image: undefined }));
    if (key === 'linkAction') setErrors((e) => ({ ...e, link: undefined }));
  };

  const isImageOnly = form.type === 'image';

  // --- Overlays ------------------------------------------------------------
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

  // --- Image ---------------------------------------------------------------
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await advertisementsService.uploadAdvertisementImage(file, form.title || 'ad');
      setForm((f) => ({ ...f, imageUrl: res.url, imageFileId: res.fileId }));
      setErrors((err) => ({ ...err, image: undefined }));
    } catch {
      // apiClient surfaces the error toast
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const clearImage = () => setForm((f) => ({ ...f, imageUrl: '', imageFileId: '' }));

  // --- Save ----------------------------------------------------------------
  /** Returns the normalized link, or null when the form is not valid. */
  const validate = (): string | null => {
    const next: FormErrors = {};

    if (isImageOnly && !form.imageUrl) {
      next.image = 'Upload the banner artwork before saving.';
    }
    if (!isImageOnly && !form.title?.trim()) {
      next.title = 'Give the ad a headline so it reads well in the carousel.';
    }

    const link =
      linkMode === 'url' ? normalizeAdUrl(form.linkAction || '') : (form.linkAction || '').trim();
    if (linkMode === 'url' && link && !isValidHttpsUrl(link)) {
      next.link = 'Enter a full web address, for example https://kayod.ph/promo';
    } else if (link.length > AD_LINK_MAX) {
      next.link = 'That link is too long.';
    }

    setErrors(next);
    return Object.keys(next).length > 0 ? null : link;
  };

  const submit = (status: AdStatus) => {
    const link = validate();
    if (link === null) return;

    const payload: AdvertisementInput = { ...form, linkAction: link, status };
    // Name the outcome, so the toast confirms what the button promised.
    const successMessage =
      status === 'draft'
        ? 'Saved as draft'
        : status === 'published' && currentStatus !== 'published'
          ? 'Advertisement published'
          : 'Changes saved';

    if (advertisement) {
      updateAdvertisement.mutate(
        { id: advertisement._id, data: payload, successMessage },
        { onSuccess: onClose },
      );
    } else {
      createAdvertisement.mutate({ data: payload, successMessage }, { onSuccess: onClose });
    }
  };

  const requestClose = () => (isDirty ? setConfirmDiscard(true) : onClose());

  const saving = createAdvertisement.isPending || updateAdvertisement.isPending;
  const busy = saving || uploading;
  // A new ad, or one that has never gone live, can still be kept as a draft.
  const canSaveAsDraft = !advertisement || currentStatus === 'draft';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-0 backdrop-blur-[2px] sm:p-4">
        <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl">
          {/* Header ------------------------------------------------------- */}
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">
                  {advertisement ? 'Edit advertisement' : 'New advertisement'}
                </h3>
                {currentStatus ? (
                  <span
                    title={STATUS_META[currentStatus].help}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[currentStatus].chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[currentStatus].dot}`} />
                    {STATUS_META[currentStatus].label}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {advertisement
                  ? 'Update the banner — the preview shows the result as you type.'
                  : 'Pick a layout, add the content, then publish it or keep it as a draft.'}
              </p>
            </div>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body --------------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* Form column */}
              <div className="min-w-0 space-y-7">
                {/* 1 — Layout */}
                <Section
                  step="1"
                  title="Choose a layout"
                  description="Each layout uses the Kayod app styling, so your ad always looks native."
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    {LAYOUTS.map((opt) => {
                      const active = form.type === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => set('type', opt.id)}
                          className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                            active
                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {active ? (
                            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            </span>
                          ) : null}
                          <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span
                            className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-900'}`}
                          >
                            {opt.label}
                          </span>
                          <span className="text-xs leading-tight text-gray-500">{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* 2 — Content */}
                <Section
                  step="2"
                  title={isImageOnly ? 'Upload your artwork' : 'Add the content'}
                  description={
                    isImageOnly
                      ? 'A wide banner image, shown edge to edge in the carousel.'
                      : 'Short lines work best — the banner is about the size of a business card.'
                  }
                >
                  {isImageOnly ? (
                    <>
                      <ImagePicker
                        imageUrl={form.imageUrl}
                        uploading={uploading}
                        onSelect={handleImageSelect}
                        onClear={clearImage}
                        error={errors.image}
                        hint="PNG or JPG, roughly 2:1 — for example 1200 × 600."
                      />

                      {/* Optional text & buttons placed on the artwork */}
                      <div className="mt-5">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Text &amp; buttons{' '}
                              <span className="font-normal text-gray-400">(optional)</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Layer these over your artwork and pick where each one sits.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => addOverlay('text')}
                              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <Type className="h-3.5 w-3.5" /> Add text
                            </button>
                            <button
                              type="button"
                              onClick={() => addOverlay('button')}
                              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              <MousePointerClick className="h-3.5 w-3.5" /> Add button
                            </button>
                          </div>
                        </div>

                        {(form.overlays || []).length === 0 ? (
                          <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                            Nothing added — your image shows on its own.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(form.overlays || []).map((ov) => (
                              <OverlayEditor
                                key={ov.id}
                                overlay={ov}
                                onChange={(patch) => updateOverlay(ov.id, patch)}
                                onRemove={() => removeOverlay(ov.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : form.type === 'invite' ? (
                    <div className="space-y-4">
                      <Field label="First line" error={errors.title}>
                        <TextInput
                          value={form.title}
                          onChange={(v) => set('title', v)}
                          placeholder="Invite a Friend,"
                          invalid={!!errors.title}
                        />
                      </Field>
                      <Field label="Second line" hint="The part you want to stand out.">
                        <TextInput
                          value={form.highlight}
                          onChange={(v) => set('highlight', v)}
                          placeholder="Get ₱50 off"
                        />
                      </Field>
                      <Field label="Button text" hint="Leave blank to use “Refer Now”.">
                        <TextInput
                          value={form.ctaLabel}
                          onChange={(v) => set('ctaLabel', v)}
                          placeholder="Refer Now"
                        />
                      </Field>
                      <Field
                        label="Background photo"
                        optional
                        hint="Replaces the teal background. Text switches to white."
                      >
                        <ImagePicker
                          imageUrl={form.imageUrl}
                          uploading={uploading}
                          onSelect={handleImageSelect}
                          onClear={clearImage}
                          compact
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Field label="Headline" error={errors.title}>
                        <TextInput
                          value={form.title}
                          onChange={(v) => set('title', v)}
                          placeholder="Special Offer"
                          invalid={!!errors.title}
                        />
                      </Field>
                      <Field label="Description" hint="One short sentence under the headline.">
                        <TextInput
                          value={form.subtitle}
                          onChange={(v) => set('subtitle', v)}
                          placeholder="Get amazing deals · use SAVE50"
                        />
                      </Field>
                      <Field label="Discount" hint="The big text, e.g. “20% off” or “₱100 off”.">
                        <TextInput
                          value={form.highlight}
                          onChange={(v) => set('highlight', v)}
                          placeholder="20% off"
                        />
                      </Field>
                      <Field label="Button text" hint="Leave blank to use “Post a Job”.">
                        <TextInput
                          value={form.ctaLabel}
                          onChange={(v) => set('ctaLabel', v)}
                          placeholder="Post a Job"
                        />
                      </Field>
                      <Field
                        label="Background photo"
                        optional
                        hint="Replaces the peach background. Text switches to white."
                      >
                        <ImagePicker
                          imageUrl={form.imageUrl}
                          uploading={uploading}
                          onSelect={handleImageSelect}
                          onClear={clearImage}
                          compact
                        />
                      </Field>
                    </div>
                  )}
                </Section>

                {/* 3 — Destination */}
                <Section
                  step="3"
                  title="Where it takes users"
                  description="The screen or web page that opens when someone taps the banner."
                >
                  <select
                    value={linkMode === 'url' ? AD_URL_SENTINEL : form.linkAction || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === AD_URL_SENTINEL) {
                        setLinkMode('url');
                        set('linkAction', isExternalLink(form.linkAction) ? form.linkAction : '');
                      } else {
                        setLinkMode('route');
                        set('linkAction', v);
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Nowhere — the banner isn’t tappable</option>
                    {AD_DESTINATION_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {AD_DESTINATIONS.filter((d) => d.group === group).map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="Other">
                      <option value={AD_URL_SENTINEL}>A website link…</option>
                    </optgroup>
                  </select>

                  {linkMode === 'url' && (
                    <div className="mt-2">
                      <TextInput
                        value={form.linkAction}
                        onChange={(v) => set('linkAction', v)}
                        placeholder="https://kayod.ph/promo"
                        invalid={!!errors.link}
                      />
                    </div>
                  )}

                  {errors.link ? (
                    <ErrorText>{errors.link}</ErrorText>
                  ) : (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {linkMode === 'url'
                        ? 'Opens in a browser inside the app. “https://” is added for you.'
                        : 'Pick an app screen so users land straight on what the ad promotes.'}
                    </p>
                  )}
                </Section>
              </div>

              {/* Preview column. Above the form on a phone, beside it on a
                  desktop — either way it stays in sight while you type. */}
              <div className="order-first lg:sticky lg:top-0 lg:order-none lg:self-start">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Live preview
                  </p>
                  <div className="mx-auto w-full max-w-[264px]">
                    <div className="h-[160px] w-full">
                      <AdBanner ad={form} />
                    </div>
                    {/* Carousel dots, as the app draws them */}
                    <div className="mt-2.5 flex items-center justify-center gap-1.5">
                      <span className="h-2 w-5 rounded-full bg-orange-500" />
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-gray-500">
                    How the banner appears on the app home screen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer ------------------------------------------------------- */}
          <div className="flex flex-shrink-0 flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {canSaveAsDraft
                ? 'Drafts stay hidden from the app until you publish them.'
                : currentStatus === 'paused'
                  ? 'This ad is paused — publish it to put it back in the carousel.'
                  : 'Changes go live in the app as soon as you save.'}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={requestClose}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              {canSaveAsDraft ? (
                <>
                  <button
                    onClick={() => submit('draft')}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    Save as draft
                  </button>
                  <button
                    onClick={() => submit('published')}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Publish
                  </button>
                </>
              ) : (
                <>
                  {currentStatus === 'paused' ? (
                    <button
                      onClick={() => submit('paused')}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save changes
                    </button>
                  ) : null}
                  <button
                    onClick={() => submit('published')}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentStatus === 'paused' ? (
                      <Send className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {currentStatus === 'paused' ? 'Save & publish' : 'Save changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDiscard}
        tone="default"
        title="Discard your changes?"
        message="The edits you made to this advertisement will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
};

// --- Building blocks ----------------------------------------------------------

const Section: React.FC<{
  step: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ step, title, description, children }) => (
  <section>
    <div className="mb-3 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
        {step}
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
    </div>
    <div className="sm:pl-[34px]">{children}</div>
  </section>
);

const Field: React.FC<{
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, optional, hint, error, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-gray-800">
      {label}
      {optional ? <span className="ml-1 font-normal text-gray-400">(optional)</span> : null}
    </label>
    {children}
    {error ? (
      <ErrorText>{error}</ErrorText>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
    ) : null}
  </div>
);

const ErrorText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
    <AlertCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
    <span>{children}</span>
  </p>
);

const TextInput: React.FC<{
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}> = ({ value, onChange, placeholder, invalid }) => (
  <input
    type="text"
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    aria-invalid={invalid || undefined}
    className={`w-full rounded-lg border px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 ${
      invalid
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/30'
    }`}
  />
);

/** Upload zone that becomes a thumbnail + replace/remove once an image is set. */
const ImagePicker: React.FC<{
  imageUrl?: string;
  uploading: boolean;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hint?: string;
  error?: string;
  compact?: boolean;
}> = ({ imageUrl, uploading, onSelect, onClear, hint, error, compact }) => {
  if (imageUrl) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2">
        <img src={imageUrl} alt="" className="h-12 w-20 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-800">Image added</p>
          {hint ? <p className="truncate text-[11px] text-gray-500">{hint}</p> : null}
        </div>
        <label className="cursor-pointer rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
          {uploading ? 'Uploading…' : 'Replace'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelect}
            disabled={uploading}
          />
        </label>
        <button
          type="button"
          onClick={onClear}
          title="Remove image"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm transition-colors ${
          error
            ? 'border-red-300 bg-red-50/40 text-red-600 hover:bg-red-50'
            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
        } ${compact ? 'px-4 py-3' : 'px-4 py-8'}`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5 text-gray-400" />
        )}
        <span className="font-medium">{uploading ? 'Uploading…' : 'Click to upload an image'}</span>
        {!compact && !uploading ? (
          <span className="text-xs text-gray-400">Max 5 MB</span>
        ) : null}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onSelect}
          disabled={uploading}
        />
      </label>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </>
  );
};

/** One text/button element layered on an image ad. */
const OverlayEditor: React.FC<{
  overlay: AdOverlay;
  onChange: (patch: Partial<AdOverlay>) => void;
  onRemove: () => void;
}> = ({ overlay, onChange, onRemove }) => {
  const isButton = overlay.kind === 'button';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
          {isButton ? <MousePointerClick className="h-3 w-3" /> : <Type className="h-3 w-3" />}
          {isButton ? 'Button' : 'Text'}
        </span>
        <input
          type="text"
          value={overlay.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={isButton ? 'Shop now' : 'Your text'}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-5">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-gray-500">Position on the image</p>
          <div className="grid w-[74px] grid-cols-3 gap-1">
            {POSITION_CELLS.map((cell, i) =>
              cell ? (
                <button
                  key={cell}
                  type="button"
                  title={POSITION_LABELS[cell]}
                  aria-label={POSITION_LABELS[cell]}
                  aria-pressed={overlay.position === cell}
                  onClick={() => onChange({ position: cell })}
                  className={`h-5 w-5 rounded transition-colors ${
                    overlay.position === cell
                      ? 'bg-blue-600 ring-2 ring-blue-200'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                />
              ) : (
                <span key={`gap-${i}`} className="h-5 w-5 rounded bg-gray-50" />
              ),
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-gray-500">Text colour</span>
          <input
            type="color"
            value={overlay.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
          />
        </label>

        {isButton ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-gray-500">Button colour</span>
            <input
              type="color"
              value={overlay.bgColor || '#E37F0D'}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-gray-200 bg-transparent p-0"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
};

export default AdvertisementFormModal;
