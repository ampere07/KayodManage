import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Check,
  Eye,
  LayoutGrid,
  Megaphone,
  MousePointerClick,
  Palette,
  Trash2,
  Type,
} from 'lucide-react';
import FormPanel, { Field, FormError, dangerButton, inputClass, primaryButton, secondaryButton } from '../../UI/FormPanel';
import PanelSection from '../../UI/PanelSection';
import AdBanner from '../AdBanner';
import { ErrorText, ImagePicker, OverlayEditor, genOverlayId } from './AdEditorParts';
import { PerformanceDetail } from './AdPerformance';
import { advertisementsService } from '../../../services/advertisementsService';
import { useAdvertisementMutations } from '../../../hooks/useAdvertisements';
import {
  AdOverlay,
  AdOverlayKind,
  AdPlacement,
  AdStatus,
  Advertisement,
  AdvertisementInput,
  AdvertisementType,
} from '../../../types/configuration.types';
import {
  PLACEMENTS,
  PLACEMENT_META,
  STATE_META,
  TYPE_META,
  adName,
  placementsOf,
  stateOf,
  statusOf,
  when,
} from '../../../constants/advertisements';
import {
  AD_DESTINATIONS,
  AD_DESTINATION_GROUPS,
  AD_DESTINATION_LABELS,
  AD_LINK_MAX,
  AD_URL_SENTINEL,
  destinationAudience,
  isExternalLink,
  isValidHttpsUrl,
  normalizeAdUrl,
} from '../../../constants/adDestinations';

/**
 * Create or edit one advertisement, in the side-panel standard (UI/FormPanel +
 * PanelSection): a live preview first, then what it looks like, what a tap
 * does, where it shows, when it runs — and, once it has run, how it did.
 */

interface AdForm {
  type: AdvertisementType;
  title: string;
  subtitle: string;
  highlight: string;
  ctaLabel: string;
  imageUrl: string;
  imageFileId: string;
  overlays: AdOverlay[];
  linkAction: string;
  placements: AdPlacement[];
  /** `datetime-local` values in the admin's own time; '' = no limit. */
  startsAt: string;
  endsAt: string;
}

const toLocalInput = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const toForm = (ad: Advertisement | null): AdForm => ({
  type: ad?.type || 'offer',
  title: ad?.title || '',
  subtitle: ad?.subtitle || '',
  highlight: ad?.highlight || '',
  ctaLabel: ad?.ctaLabel || '',
  imageUrl: ad?.imageUrl || '',
  imageFileId: ad?.imageFileId || '',
  overlays: ad?.overlays || [],
  linkAction: ad?.linkAction || '',
  placements: ad ? placementsOf(ad) : ['client_home'],
  startsAt: toLocalInput(ad?.startsAt),
  endsAt: toLocalInput(ad?.endsAt),
});

const LAYOUTS = (['offer', 'invite', 'image'] as AdvertisementType[]).map((id) => ({ id, ...TYPE_META[id] }));

type Errors = Partial<Record<'title' | 'image' | 'link' | 'placements' | 'schedule', string>>;

/** Tomorrow at 9:00, the default when a start time is switched on. */
const tomorrowNine = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

const plusDays = (local: string, days: number) => {
  const d = local ? new Date(local) : new Date();
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

const TextBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; name: string; maxLength?: number }> = ({ value, onChange, placeholder, invalid, name, maxLength = 80 }) => (
  <input
    type="text"
    name={name}
    value={value}
    maxLength={maxLength}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    aria-invalid={invalid || undefined}
    className={`${inputClass} ${invalid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
  />
);

/** A quiet warning that doesn't block saving. */
const Warning: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800" data-testid={testId}>
    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-px" />
    <span>{children}</span>
  </p>
);

const AdvertisementPanel: React.FC<{
  open: boolean;
  advertisement: Advertisement | null;
  onClose: () => void;
}> = ({ open, advertisement, onClose }) => {
  const { createAdvertisement, updateAdvertisement, deleteAdvertisement } = useAdvertisementMutations();
  const [form, setForm] = useState<AdForm>(toForm(null));
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, setUploading] = useState(false);
  const [linkMode, setLinkMode] = useState<'route' | 'url'>('route');
  const [confirm, setConfirm] = useState<null | 'delete' | 'discard'>(null);
  const baseline = useRef('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const next = toForm(advertisement);
    setForm(next);
    setErrors({});
    setConfirm(null);
    setLinkMode(isExternalLink(next.linkAction) ? 'url' : 'route');
    baseline.current = JSON.stringify(next);
  }, [open, advertisement]);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline.current, [form]);
  const now = new Date();
  const currentStatus: AdStatus | null = advertisement ? statusOf(advertisement) : null;
  const isImage = form.type === 'image';

  const set = <K extends keyof AdForm>(key: K, value: AdForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const map: Partial<Record<keyof AdForm, keyof Errors>> = {
        title: 'title', imageUrl: 'image', linkAction: 'link', placements: 'placements', startsAt: 'schedule', endsAt: 'schedule',
      };
      const field = map[key];
      return field ? { ...e, [field]: undefined } : e;
    });
  };

  // Overlays
  const addOverlay = (kind: AdOverlayKind) =>
    set('overlays', [...form.overlays, {
      id: genOverlayId(),
      kind,
      text: kind === 'button' ? 'Shop now' : 'Your text',
      color: '#FFFFFF',
      bgColor: kind === 'button' ? '#E37F0D' : undefined,
      position: kind === 'button' ? 'bottom-left' : 'top-left',
    }]);
  const updateOverlay = (id: string | undefined, patch: Partial<AdOverlay>) =>
    set('overlays', form.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const removeOverlay = (id: string | undefined) => set('overlays', form.overlays.filter((o) => o.id !== id));

  // Image
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

  // Placements
  const togglePlacement = (p: AdPlacement) =>
    set('placements', form.placements.includes(p) ? form.placements.filter((x) => x !== p) : PLACEMENTS.filter((x) => x === p || form.placements.includes(x)));

  // What it would be, if saved as published now — for the schedule summary.
  const scheduleState = stateOf({ status: 'published', isActive: true, startsAt: fromLocalInput(form.startsAt), endsAt: fromLocalInput(form.endsAt) }, now);
  const audience = destinationAudience(form.linkAction);
  const providerOnlyWarning = audience === 'clients' && form.placements.includes('provider_home');
  const clientOnlyWarning = audience === 'providers' && form.placements.includes('client_home');

  /** The normalized link, or null when something has to be fixed first. */
  const validate = (): string | null => {
    const next: Errors = {};
    if (isImage && !form.imageUrl) next.image = 'Upload the banner artwork first.';
    if (!isImage && !form.title.trim()) next.title = 'Give it a headline — it is the first thing people read.';
    const link = linkMode === 'url' ? normalizeAdUrl(form.linkAction) : form.linkAction.trim();
    if (linkMode === 'url' && link && !isValidHttpsUrl(link)) next.link = 'Enter a full web address, for example https://kayod.ph/promo';
    else if (link.length > AD_LINK_MAX) next.link = 'That link is too long.';
    if (form.placements.length === 0) next.placements = 'Pick at least one place for it to show.';
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) next.schedule = 'The end must be after the start.';
    setErrors(next);
    if (Object.keys(next).length) {
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return null;
    }
    return link;
  };

  const submit = (status: AdStatus) => {
    const link = validate();
    if (link === null) return;
    const payload: AdvertisementInput = {
      ...form,
      linkAction: link,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      status,
    };
    const willBe = stateOf({ status, isActive: status === 'published', startsAt: payload.startsAt, endsAt: payload.endsAt }, new Date());
    const successMessage =
      status === 'draft' ? 'Saved as draft'
        : willBe === 'scheduled' ? `Scheduled — it goes live ${when(payload.startsAt as string)}`
          : status === 'published' && currentStatus !== 'published' ? 'Published — it is in the app now'
            : 'Changes saved';
    if (advertisement) updateAdvertisement.mutate({ id: advertisement._id, data: payload, successMessage }, { onSuccess: onClose });
    else createAdvertisement.mutate({ data: payload, successMessage }, { onSuccess: onClose });
  };

  const saving = createAdvertisement.isPending || updateAdvertisement.isPending;
  const busy = saving || uploading || deleteAdvertisement.isPending;
  const requestClose = () => (dirty ? setConfirm('discard') : onClose());
  const errorList = Object.values(errors).filter(Boolean) as string[];

  const state = advertisement ? stateOf(advertisement, now) : null;
  const header = (
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-11 w-11 rounded-xl bg-blue-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <Megaphone className="h-5 w-5 text-blue-600" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{advertisement ? 'Advertisement' : 'New advertisement'}</p>
        <h2 className="text-lg font-bold text-gray-900 truncate leading-tight" data-testid="ad-panel-title">
          {advertisement ? adName({ ...advertisement, title: form.title, type: form.type }) : form.title.trim() || 'Create an ad'}
        </h2>
        <p className="text-[11px] text-gray-500 truncate">
          {state ? `${STATE_META[state].label} · ${STATE_META[state].help}` : 'Drafts stay hidden from the app until you publish them'}
        </p>
      </div>
    </div>
  );

  const footer =
    confirm === 'delete' && advertisement ? (
      <div className="space-y-2" data-testid="ad-delete-confirm">
        <p className="text-xs text-gray-700">
          <span className="font-semibold text-gray-900">Delete {adName(advertisement)}?</span> It leaves the app, its view and tap counts are
          deleted, and its image goes too unless a copy still uses it. Pause it instead to only hide it.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={() => setConfirm(null)} disabled={busy}>Keep it</button>
          <button
            type="button"
            onClick={() => deleteAdvertisement.mutate(advertisement._id, { onSuccess: onClose })}
            disabled={busy}
            className="h-9 px-4 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            data-testid="ad-delete-yes"
          >
            {deleteAdvertisement.isPending ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    ) : confirm === 'discard' ? (
      <div className="space-y-2" data-testid="ad-discard-confirm">
        <p className="text-xs text-gray-700"><span className="font-semibold text-gray-900">Discard your changes?</span> What you changed here won't be saved.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={() => setConfirm(null)}>Keep editing</button>
          <button type="button" className={primaryButton} onClick={onClose} data-testid="ad-discard-yes">Discard</button>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-2">
        {advertisement ? (
          <button type="button" className={`${dangerButton} inline-flex items-center gap-1.5`} onClick={() => setConfirm('delete')} disabled={busy} data-testid="ad-delete">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button type="button" className={secondaryButton} onClick={requestClose} disabled={saving}>Cancel</button>
          {!advertisement || currentStatus === 'draft' ? (
            <>
              <button type="button" className={secondaryButton} onClick={() => submit('draft')} disabled={busy || (Boolean(advertisement) && !dirty)} data-testid="ad-save-draft">
                Save as draft
              </button>
              <button type="button" className={primaryButton} onClick={() => submit('published')} disabled={busy} data-testid="ad-publish">
                {saving ? 'Saving…' : scheduleState === 'scheduled' ? 'Schedule' : 'Publish'}
              </button>
            </>
          ) : currentStatus === 'paused' ? (
            <>
              <button type="button" className={secondaryButton} onClick={() => submit('paused')} disabled={busy || !dirty} data-testid="ad-save">Save changes</button>
              <button type="button" className={primaryButton} onClick={() => submit('published')} disabled={busy} data-testid="ad-publish">
                {saving ? 'Saving…' : 'Save & publish'}
              </button>
            </>
          ) : (
            <button type="button" className={primaryButton} onClick={() => submit('published')} disabled={busy || !dirty} data-testid="ad-save">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <FormPanel
      open={open}
      onClose={confirm ? () => setConfirm(null) : requestClose}
      onSubmit={(e) => e.preventDefault()}
      testId="ad-panel"
      header={header}
      footer={footer}
      bodyRef={bodyRef}
    >
      <FormError message={errorList.length ? errorList.join(' ') : null} testId="ad-error" />

      <PanelSection icon={Eye} label="Preview" description="As it appears in the app's carousel" testId="ad-preview">
        <div className="mx-auto w-full max-w-[340px]">
          <div className="h-[168px] w-full" data-testid="ad-preview-banner"><AdBanner ad={form} /></div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="h-2 w-5 rounded-full bg-orange-500" />
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="h-2 w-2 rounded-full bg-gray-300" />
          </div>
        </div>
      </PanelSection>

      <PanelSection icon={Palette} label="Design" description="Every layout uses the app's own styling" testId="ad-design">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Layout">
          {LAYOUTS.map((opt) => {
            const active = form.type === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set('type', opt.id)}
                className={`relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                data-testid={`ad-layout-${opt.id}`}
              >
                {active && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
                <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-900'}`}>{opt.label}</span>
                <span className="text-[11px] leading-tight text-gray-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          {isImage ? (
            <>
              <Field label="Name" hint="Only admins see it — it names the ad in this list.">
                <TextBox name="title" value={form.title} onChange={(v) => set('title', v)} placeholder="e.g. Rainy season promo" />
              </Field>
              <div>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Banner artwork</span>
                <ImagePicker imageUrl={form.imageUrl} uploading={uploading} onSelect={handleImageSelect} onClear={clearImage} error={errors.image} hint="PNG or JPG, roughly 2:1 — for example 1200 × 600." />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-500">Text & buttons on the artwork (optional)</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addOverlay('text')} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" data-testid="ad-add-text">
                      <Type className="h-3.5 w-3.5" /> Add text
                    </button>
                    <button type="button" onClick={() => addOverlay('button')} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" data-testid="ad-add-button">
                      <MousePointerClick className="h-3.5 w-3.5" /> Add button
                    </button>
                  </div>
                </div>
                {form.overlays.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-[11px] text-gray-400">Nothing added — the artwork shows on its own.</p>
                ) : (
                  <div className="space-y-2">
                    {form.overlays.map((ov) => (
                      <OverlayEditor key={ov.id} overlay={ov} onChange={(patch) => updateOverlay(ov.id, patch)} onRemove={() => removeOverlay(ov.id)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : form.type === 'invite' ? (
            <>
              <Field label="First line">
                <TextBox name="title" value={form.title} onChange={(v) => set('title', v)} placeholder="Invite a Friend," invalid={Boolean(errors.title)} />
              </Field>
              {errors.title && <ErrorText>{errors.title}</ErrorText>}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Second line" hint="The part that stands out">
                  <TextBox name="highlight" value={form.highlight} onChange={(v) => set('highlight', v)} placeholder="Get ₱50 off" />
                </Field>
                <Field label="Button text" hint="Blank = “Refer Now”">
                  <TextBox name="ctaLabel" value={form.ctaLabel} onChange={(v) => set('ctaLabel', v)} placeholder="Refer Now" maxLength={24} />
                </Field>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Background photo (optional)</span>
                <ImagePicker imageUrl={form.imageUrl} uploading={uploading} onSelect={handleImageSelect} onClear={clearImage} compact hint="Replaces the teal background; the text turns white." />
              </div>
            </>
          ) : (
            <>
              <Field label="Headline">
                <TextBox name="title" value={form.title} onChange={(v) => set('title', v)} placeholder="Special Offer" invalid={Boolean(errors.title)} />
              </Field>
              {errors.title && <ErrorText>{errors.title}</ErrorText>}
              <Field label="Description" hint="One short sentence under the headline">
                <TextBox name="subtitle" value={form.subtitle} onChange={(v) => set('subtitle', v)} placeholder="Get amazing deals · use SAVE50" maxLength={90} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Discount" hint="The big text, e.g. 20% off">
                  <TextBox name="highlight" value={form.highlight} onChange={(v) => set('highlight', v)} placeholder="20% off" maxLength={24} />
                </Field>
                <Field label="Button text" hint="Blank = “Post a Job”">
                  <TextBox name="ctaLabel" value={form.ctaLabel} onChange={(v) => set('ctaLabel', v)} placeholder="Post a Job" maxLength={24} />
                </Field>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-gray-500 mb-1">Background photo (optional)</span>
                <ImagePicker imageUrl={form.imageUrl} uploading={uploading} onSelect={handleImageSelect} onClear={clearImage} compact hint="Replaces the peach background; the text turns white." />
              </div>
            </>
          )}
        </div>
      </PanelSection>

      <PanelSection icon={MousePointerClick} label="On tap" description="Where a tap takes people" testId="ad-destination">
        <select
          name="destination"
          value={linkMode === 'url' ? AD_URL_SENTINEL : form.linkAction}
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
          className={inputClass}
        >
          <option value="">The banner's own default</option>
          {AD_DESTINATION_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {AD_DESTINATIONS.filter((d) => d.group === group).map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Other">
            <option value={AD_URL_SENTINEL}>A website link…</option>
          </optgroup>
        </select>
        {linkMode === 'url' && (
          <div className="mt-2">
            <TextBox name="linkUrl" value={form.linkAction} onChange={(v) => set('linkAction', v)} placeholder="https://kayod.ph/promo" invalid={Boolean(errors.link)} maxLength={AD_LINK_MAX} />
          </div>
        )}
        {errors.link ? (
          <ErrorText>{errors.link}</ErrorText>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400">
            {linkMode === 'url'
              ? 'Opens in a browser inside the app; “https://” is added for you.'
              : form.linkAction
                ? `Opens ${AD_DESTINATION_LABELS[form.linkAction] || form.linkAction} in the app.`
                : `Clients go to ${form.type === 'invite' ? 'Refer & Earn' : 'Post a Job'}; on the provider home a tap does nothing.`}
          </p>
        )}
        {providerOnlyWarning && <Warning testId="ad-warning-audience">{AD_DESTINATION_LABELS[form.linkAction]} is for clients — providers who tap it from their home land somewhere they can't use.</Warning>}
        {clientOnlyWarning && <Warning testId="ad-warning-audience">{AD_DESTINATION_LABELS[form.linkAction]} is for providers — clients who tap it from their home land somewhere they can't use.</Warning>}
        {!form.linkAction && form.placements.includes('provider_home') && <Warning testId="ad-warning-no-destination">On the provider home this ad does nothing when tapped. Pick a destination.</Warning>}
      </PanelSection>

      <PanelSection icon={LayoutGrid} label="Shows on" description="The carousels in the app it appears in" testId="ad-placements">
        <div className="grid gap-2 sm:grid-cols-2">
          {PLACEMENTS.map((p) => {
            const on = form.placements.includes(p);
            return (
              <button
                key={p}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => togglePlacement(p)}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all ${on ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                data-testid={`ad-placement-${p}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
                  {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${on ? 'text-blue-700' : 'text-gray-900'}`}>{PLACEMENT_META[p].label}</span>
                  <span className="block text-[11px] leading-snug text-gray-500">{PLACEMENT_META[p].where}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.placements && <ErrorText>{errors.placements}</ErrorText>}
      </PanelSection>

      <PanelSection icon={CalendarClock} label="Schedule" description="When it runs, once it's published" testId="ad-schedule" last={!advertisement}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Starts</span>
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold mb-2" role="radiogroup" aria-label="Starts">
              <button type="button" role="radio" aria-checked={!form.startsAt} onClick={() => set('startsAt', '')} className={`flex-1 rounded-md px-2 py-1.5 ${!form.startsAt ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`} data-testid="ad-start-now">Right away</button>
              <button type="button" role="radio" aria-checked={Boolean(form.startsAt)} onClick={() => set('startsAt', form.startsAt || tomorrowNine())} className={`flex-1 rounded-md px-2 py-1.5 ${form.startsAt ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`} data-testid="ad-start-later">On a date</button>
            </div>
            {form.startsAt && (
              <input type="datetime-local" name="startsAt" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} className={inputClass} />
            )}
          </div>
          <div>
            <span className="block text-[11px] font-medium text-gray-500 mb-1">Ends</span>
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold mb-2" role="radiogroup" aria-label="Ends">
              <button type="button" role="radio" aria-checked={!form.endsAt} onClick={() => set('endsAt', '')} className={`flex-1 rounded-md px-2 py-1.5 ${!form.endsAt ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`} data-testid="ad-end-never">When paused</button>
              <button type="button" role="radio" aria-checked={Boolean(form.endsAt)} onClick={() => set('endsAt', form.endsAt || plusDays(form.startsAt, 7))} className={`flex-1 rounded-md px-2 py-1.5 ${form.endsAt ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`} data-testid="ad-end-later">On a date</button>
            </div>
            {form.endsAt && (
              <input type="datetime-local" name="endsAt" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={inputClass} />
            )}
          </div>
        </div>
        {errors.schedule ? (
          <ErrorText>{errors.schedule}</ErrorText>
        ) : (
          <p className="mt-2 text-[11px] text-gray-600" data-testid="ad-schedule-summary">
            {form.startsAt ? `From ${when(new Date(form.startsAt))}` : 'From the moment it is published'}
            {form.endsAt ? ` until ${when(new Date(form.endsAt))}` : ' until you pause it'}
            {scheduleState === 'scheduled' ? ' — published now, it waits as Scheduled.' : '.'}
          </p>
        )}
        {scheduleState === 'ended' && !errors.schedule && <Warning testId="ad-warning-ended">That end time has already passed — published, it would show as Ended and stay out of the app.</Warning>}
        <p className="mt-1 text-[11px] text-gray-400">Times are your computer's local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}). The app starts and stops it on its own.</p>
      </PanelSection>

      {advertisement && (
        <PanelSection icon={BarChart3} label="Performance" description="What the app counted while it ran" testId="ad-performance-section" last>
          <PerformanceDetail stats={advertisement.stats} placements={form.placements} />
        </PanelSection>
      )}
    </FormPanel>
  );
};

export default AdvertisementPanel;
