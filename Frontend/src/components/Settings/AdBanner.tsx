import React from 'react';
import { AdOverlay, AdOverlayPosition } from '../../types/configuration.types';

// Design tokens mirrored from the Kayod client design system
// (kayod/client/src/utils/theme.js + Invite/OfferBanner).
export const KAYOD = {
  primary: '#E37F0D', // orange — CTAs, offer title & discount
  primaryLight: '#ffead1', // warm peach — offer banner surface
  inviteTeal: '#0D6E6E', // invite banner surface
  white: '#FFFFFF',
  textSecondary: '#808080', // offer description text
  dotActive: '#E37F0D',
  dotInactive: '#D1D5DB',
};

export interface AdBannerData {
  type?: string; // 'invite' | 'offer' | 'image'
  title?: string;
  subtitle?: string;
  highlight?: string;
  ctaLabel?: string;
  imageUrl?: string;
  overlays?: AdOverlay[];
}

// Text drawn over a photo needs a shadow to stay legible on light areas.
const OVER_IMAGE_SHADOW = '0 1px 3px rgba(0,0,0,0.55)';

// Anchor an overlay to a corner/center of the image.
const overlayPositionClass = (position?: AdOverlayPosition): string => {
  switch (position) {
    case 'top-left':
      return 'left-3 top-3';
    case 'top-right':
      return 'right-3 top-3 text-right';
    case 'center':
      return 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center';
    case 'bottom-right':
      return 'right-3 bottom-3 text-right';
    case 'bottom-left':
    default:
      return 'left-3 bottom-3';
  }
};

const CtaPill: React.FC<{ label: string }> = ({ label }) => (
  <span
    className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold text-white"
    style={{ backgroundColor: KAYOD.primary }}
  >
    {label}
    <span aria-hidden>›</span>
  </span>
);

/** Full-bleed photo + scrim, used when an invite/offer ad has a background image. */
const PhotoBackdrop: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <>
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/60" />
  </>
);

/**
 * Renders a promo banner exactly matching the Kayod client design system.
 * Fills its parent — set the height on the wrapping element.
 */
export const AdBanner: React.FC<{ ad: AdBannerData }> = ({ ad }) => {
  const type = ad.type || 'offer';

  if (type === 'image') {
    if (!ad.imageUrl) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
          No image uploaded
        </div>
      );
    }
    return (
      <div className="relative h-full w-full overflow-hidden rounded-2xl">
        <img src={ad.imageUrl} alt={ad.title || 'Advertisement'} className="h-full w-full object-cover" />
        {(ad.overlays || []).map((ov, i) => (
          <div key={ov.id || i} className={`absolute max-w-[80%] ${overlayPositionClass(ov.position)}`}>
            {ov.kind === 'button' ? (
              <span
                className="inline-block rounded-full px-4 py-2 text-xs font-bold"
                style={{ backgroundColor: ov.bgColor || KAYOD.primary, color: ov.color || '#FFFFFF' }}
              >
                {ov.text || 'Button'}
              </span>
            ) : (
              <span
                className="text-base font-extrabold leading-tight"
                style={{ color: ov.color || '#FFFFFF', textShadow: OVER_IMAGE_SHADOW }}
              >
                {ov.text || 'Text'}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // A background photo replaces the flat brand colour and flips text to white.
  const photo = ad.imageUrl || '';
  const onPhoto = Boolean(photo);
  const textShadow = onPhoto ? OVER_IMAGE_SHADOW : undefined;

  if (type === 'invite') {
    return (
      <div
        className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-4"
        style={{ backgroundColor: onPhoto ? '#000000' : KAYOD.inviteTeal }}
      >
        {onPhoto ? <PhotoBackdrop src={photo} alt={ad.title || 'Advertisement'} /> : null}
        <div className="relative z-10 max-w-[68%]">
          <p className="text-lg font-extrabold leading-tight text-white" style={{ textShadow }}>
            {ad.title || 'Invite a Friend,'}
          </p>
          <p className="text-lg font-extrabold leading-tight text-white" style={{ textShadow }}>
            {ad.highlight || 'Get ₱50 off'}
          </p>
        </div>
        <div className="relative z-10">
          <CtaPill label={ad.ctaLabel || 'Refer Now'} />
        </div>
        {onPhoto ? null : <div className="absolute bottom-1 right-3 text-5xl">🙌</div>}
      </div>
    );
  }

  // 'offer' (default)
  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-4"
      style={{ backgroundColor: onPhoto ? '#000000' : KAYOD.primaryLight }}
    >
      {onPhoto ? <PhotoBackdrop src={photo} alt={ad.title || 'Advertisement'} /> : null}
      {onPhoto ? null : (
        /* discount badge stand-in for discount.webp */
        <div className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-white shadow-sm">
          %
        </div>
      )}
      <div className="relative z-10 max-w-[72%]">
        <p
          className="text-base font-extrabold"
          style={{ color: onPhoto ? '#FFFFFF' : KAYOD.primary, textShadow }}
        >
          {ad.title || 'Special Offer'}
        </p>
        {ad.subtitle ? (
          <p
            className="mt-1 text-[11px] leading-snug"
            style={{ color: onPhoto ? 'rgba(255,255,255,0.9)' : KAYOD.textSecondary, textShadow }}
          >
            {ad.subtitle}
          </p>
        ) : null}
      </div>
      <div className="relative z-10 flex items-end justify-between gap-2">
        <span
          className="text-2xl font-extrabold"
          style={{ color: onPhoto ? '#FFFFFF' : KAYOD.primary, textShadow }}
        >
          {ad.highlight || '20% off'}
        </span>
        <CtaPill label={ad.ctaLabel || 'Post a Job'} />
      </div>
    </div>
  );
};

export default AdBanner;
