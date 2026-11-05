import React, { useRef, useState } from 'react';
import {
  Bell,
  Briefcase,
  ChevronDown,
  Home,
  MessageSquare,
  Navigation,
  Plus,
  Search,
  User,
} from 'lucide-react';
import AdBanner, { AdBannerData, KAYOD } from '../AdBanner';
import type { AdPlacement } from '../../../types/configuration.types';

/**
 * A static, faithful sketch of a Kayod home screen (kayod/client
 * src/screens/HomeScreen.jsx) in a phone frame, with the ad carousel
 * highlighted and filled with the ads showing there now.
 *
 *  - Client home: managed ads lead, then the app's built-in slides — the
 *    "Invite a Friend" banner and the coupon offers (a sample offer here) —
 *    exactly as HomeScreen builds the carousel.
 *  - Provider home: managed ads only, under the job stats. With none, the app
 *    draws no carousel at all.
 */

export interface PreviewSlide extends AdBannerData {
  key: string;
  /** One of the app's own slides, not an ad anyone manages. */
  builtIn?: boolean;
}

const BUILT_IN_CLIENT_SLIDES: PreviewSlide[] = [
  { key: 'built-in-invite', builtIn: true, type: 'invite', title: 'Invite a Friend', highlight: 'Get ₱50 off', ctaLabel: 'Refer Now' },
  { key: 'built-in-offer', builtIn: true, type: 'offer', title: 'Special Offer', subtitle: 'Get amazing deals on services', highlight: '20% OFF', ctaLabel: 'Post a Job' },
];

export const slidesFor = (placement: AdPlacement, ads: PreviewSlide[]) =>
  placement === 'client_home' ? [...ads, ...BUILT_IN_CLIENT_SLIDES] : ads;

const CATEGORIES = [
  { label: 'Electrical', emoji: '⚡' },
  { label: 'Plumbing', emoji: '🔧' },
  { label: 'Cleaning', emoji: '🧹' },
  { label: 'Aircon', emoji: '❄️' },
];

const Carousel: React.FC<{ slides: PreviewSlide[]; testId: string }> = ({ slides, testId }) => {
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setActive(i);
  };
  return (
    <div className="relative" data-testid={testId}>
      <span className="absolute -top-2 left-3 z-10 rounded-full bg-orange-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
        Ad carousel
      </span>
      <div className="rounded-2xl ring-2 ring-orange-400 ring-offset-2">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide) => (
            <div key={slide.key} className="relative h-40 w-full shrink-0 snap-center" data-testid="preview-slide" data-built-in={slide.builtIn ? 'true' : undefined}>
              <AdBanner ad={slide} />
              {slide.builtIn && (
                <span className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-semibold text-white">
                  Built into the app
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {slides.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className="h-2 rounded-full transition-all"
            style={{ width: i === active ? 20 : 8, backgroundColor: i === active ? KAYOD.dotActive : KAYOD.dotInactive }}
          />
        ))}
      </div>
    </div>
  );
};

const TabItem: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean }> = ({ icon: Icon, label, active }) => (
  <div className="flex w-12 flex-col items-center gap-0.5">
    <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : 'text-gray-400'}`} />
    <span className={`text-[9px] font-medium ${active ? 'text-orange-500' : 'text-gray-400'}`}>{label}</span>
  </div>
);

const ClientHome: React.FC<{ slides: PreviewSlide[] }> = ({ slides }) => (
  <>
    <div className="bg-gradient-to-b from-orange-50 to-white px-4 pb-3 pt-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-800">
          <Navigation className="h-4 w-4 -rotate-45" />
          <span className="text-sm font-semibold">Bahay Namin</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </div>
        <Bell className="h-5 w-5 text-gray-700" />
      </div>
      <h3 className="mt-5 max-w-[70%] text-2xl font-bold leading-tight text-gray-900">What service do you need?</h3>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-400">Search services…</span>
      </div>
    </div>
    <div className="px-4 pt-3">
      <span className="text-sm font-bold text-gray-900">Popular Categories</span>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="flex flex-col items-center gap-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-xl">{cat.emoji}</div>
            <span className="w-full truncate text-center text-[9px] font-medium text-gray-600">{cat.label}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="mx-4 mt-5">
      <Carousel slides={slides} testId="preview-carousel-client_home" />
    </div>
    <div className="mx-4 mt-5 mb-4 space-y-2">
      <span className="text-sm font-bold text-gray-900">Top Rated</span>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2">
          <div className="h-9 w-9 rounded-full bg-orange-100" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 w-24 rounded bg-gray-200" />
            <div className="h-2 w-16 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  </>
);

const ProviderHome: React.FC<{ slides: PreviewSlide[] }> = ({ slides }) => (
  <>
    <div className="px-4 pb-2 pt-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-500">Good morning,</p>
          <p className="text-base font-bold text-gray-900">Juan</p>
        </div>
        <Bell className="h-5 w-5 text-gray-700" />
      </div>
    </div>
    <div className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-[10px] font-semibold text-gray-500">Upcoming job</p>
      <div className="mt-1.5 h-2.5 w-32 rounded bg-gray-200" />
      <div className="mt-1 h-2 w-20 rounded bg-gray-100" />
    </div>
    <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
      {['Jobs Completed', 'Ongoing Jobs'].map((label) => (
        <div key={label} className="rounded-2xl border border-gray-100 p-3">
          <p className="text-[9px] font-medium text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{label === 'Ongoing Jobs' ? 2 : 14}</p>
        </div>
      ))}
    </div>
    <div className="mx-4 mt-5">
      {slides.length > 0 ? (
        <Carousel slides={slides} testId="preview-carousel-provider_home" />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center" data-testid="preview-no-provider-carousel">
          <p className="text-[11px] font-semibold text-gray-600">No carousel here</p>
          <p className="mt-0.5 text-[10px] text-gray-400">Providers see one once an ad showing now is aimed at Provider home.</p>
        </div>
      )}
    </div>
    <div className="mx-4 mt-5 mb-4 space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
        <Search className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-400">Search jobs…</span>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-3">
          <div className="h-2.5 w-28 rounded bg-gray-200" />
          <div className="mt-1.5 h-2 w-20 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  </>
);

const AdPhonePreview: React.FC<{ placement: AdPlacement; ads: PreviewSlide[] }> = ({ placement, ads }) => {
  const slides = slidesFor(placement, ads);
  return (
    <div className="mx-auto w-[300px] max-w-full rounded-[2.5rem] bg-gray-900 p-3 shadow-2xl" data-testid={`phone-${placement}`}>
      <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[2rem] bg-white">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
          {placement === 'client_home' ? <ClientHome slides={slides} /> : <ProviderHome slides={slides} />}
        </div>
        <div className="relative flex items-center justify-between border-t border-gray-100 bg-white px-5 pb-4 pt-2">
          <TabItem icon={Home} label="Home" active />
          <TabItem icon={Briefcase} label="Jobs" />
          <div className="relative -mt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40">
              <Plus className="h-6 w-6 text-white" />
            </div>
          </div>
          <TabItem icon={MessageSquare} label="Messages" />
          <TabItem icon={User} label="Profile" />
        </div>
      </div>
    </div>
  );
};

export default AdPhonePreview;
