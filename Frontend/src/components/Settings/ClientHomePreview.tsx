import React from 'react';
import {
  Navigation,
  Bell,
  ChevronDown,
  Search,
  Home,
  Briefcase,
  MessageSquare,
  User,
  Star,
  Plus,
} from 'lucide-react';
import { Advertisement } from '../../types/configuration.types';
import AdBanner, { KAYOD, AdBannerData } from './AdBanner';

// A faithful (static) preview of the Kayod client Home screen
// (kayod/client/src/screens/HomeScreen.jsx), rendered in a phone frame so admins
// can see where advertisements appear. The two ad placements — the promo banner
// carousel and the "Sponsored Providers" carousel — are highlighted.

const CATEGORIES: { label: string; emoji: string }[] = [
  { label: 'Electrical', emoji: '⚡' },
  { label: 'Plumbing', emoji: '🔧' },
  { label: 'Home Cleaning', emoji: '🧹' },
  { label: 'Aircon & Refri…', emoji: '❄️' },
  { label: 'Car Wash', emoji: '🚗' },
  { label: 'Massage', emoji: '💆' },
  { label: 'Carpentry & C…', emoji: '🔨' },
  { label: 'Lipat Bahay (…', emoji: '🚚' },
];

const PROVIDERS: { name: string; role: string; rating: string }[] = [
  { name: 'Robert', role: 'AUTO MECHANIC', rating: '4.9' },
  { name: 'Janet', role: 'HOUSE CLEANER', rating: '4.8' },
  { name: 'Marco', role: 'ELECTRICIAN', rating: '5.0' },
];

// Sample ads shown when none are configured yet, so the preview is never empty.
const DEFAULT_ADS: AdBannerData[] = [
  { type: 'invite', title: 'Invite a Friend,', highlight: 'Get ₱50 off', ctaLabel: 'Refer Now' },
  {
    type: 'offer',
    title: 'Special Offer',
    subtitle: 'Get amazing deals on services · use SAVE50',
    highlight: '20% off',
    ctaLabel: 'Post a Job',
  },
];

const AdTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="absolute -top-2 left-3 z-10 rounded-full bg-orange-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
    {label}
  </span>
);

interface ClientHomePreviewProps {
  /** Ads to render in the promo carousel. Falls back to sample ads when empty. */
  ads?: Advertisement[];
  /** Hide the intro copy (e.g. when embedded next to the ad manager). */
  showIntro?: boolean;
}

const ClientHomePreview: React.FC<ClientHomePreviewProps> = ({ ads, showIntro = true }) => {
  const displayAds: AdBannerData[] = ads && ads.length > 0 ? ads : DEFAULT_ADS;

  return (
    <div className="p-4 md:p-6 bg-white">
      {/* Intro */}
      {showIntro && (
        <div className="max-w-md mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Client Home Screen</h2>
          <p className="text-sm text-gray-500 mt-1">
            Preview of where advertisements appear in the Kayod client app. The
            highlighted sections — the <span className="font-medium text-orange-600">promo banner</span> and{' '}
            <span className="font-medium text-orange-600">Sponsored Providers</span> — are the ad placements.
          </p>
        </div>
      )}

      {/* Phone frame */}
      <div className="mx-auto w-[320px] max-w-full rounded-[2.5rem] bg-gray-900 p-3 shadow-2xl">
        <div className="relative flex h-[640px] flex-col overflow-hidden rounded-[2rem] bg-white">
          {/* Notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-5 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />

          {/* Scrollable screen content */}
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-b from-orange-50 to-white px-4 pb-3 pt-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-800">
                  <Navigation className="h-4 w-4 -rotate-45" />
                  <span className="text-sm font-semibold">Bahay Namin</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </div>
                <div className="relative">
                  <Bell className="h-5 w-5 text-gray-700" />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500" />
                </div>
              </div>

              {/* Heading */}
              <div className="relative mt-5">
                <div className="pointer-events-none absolute -right-2 -top-4 h-24 w-24 rotate-12 rounded-3xl bg-orange-200/40 blur-md" />
                <h3 className="relative max-w-[70%] text-2xl font-bold leading-tight text-gray-900">
                  What service do you need?
                </h3>
              </div>

              {/* Search */}
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-400">Search services…</span>
              </div>
            </div>

            {/* Popular Categories */}
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Popular Categories</span>
                <span className="text-xs font-medium text-orange-600">See all</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-3">
                {CATEGORIES.map((cat) => (
                  <div key={cat.label} className="flex flex-col items-center gap-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                      {cat.emoji}
                    </div>
                    <span className="w-full truncate text-center text-[9px] font-medium text-gray-600">
                      {cat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo banner carousel (Ad placement) */}
            <div className="relative mx-4 mt-5">
              <AdTag label="Ad" />
              <div className="rounded-2xl ring-2 ring-orange-400 ring-offset-2">
                <div className="flex snap-x gap-3 overflow-x-auto rounded-2xl">
                  {displayAds.map((ad, idx) => (
                    <div key={idx} className="h-40 w-full shrink-0 snap-center">
                      <AdBanner ad={ad} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Carousel dots (design-system: active orange + wider) */}
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {displayAds.map((_, idx) => (
                  <span
                    key={idx}
                    className="h-2 rounded-full"
                    style={{
                      width: idx === 0 ? 20 : 8,
                      backgroundColor: idx === 0 ? KAYOD.dotActive : KAYOD.dotInactive,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Sponsored Providers (Ad placement) */}
            <div className="relative mx-4 mb-4 mt-5">
              <div className="rounded-2xl ring-2 ring-orange-400 ring-offset-2">
                <div className="rounded-2xl bg-white p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                        Ad
                      </span>
                      <span className="text-sm font-bold text-gray-900">Sponsored Providers</span>
                    </div>
                    <span className="text-xs font-medium text-orange-600">Browse</span>
                  </div>

                  {/* Provider cards (horizontal carousel) */}
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {PROVIDERS.map((p) => (
                      <div
                        key={p.name}
                        className="w-[130px] flex-shrink-0 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm"
                      >
                        <span className="mx-auto mb-2 inline-block rounded-full border border-gray-200 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-gray-500">
                          {p.role}
                        </span>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 ring-2 ring-orange-400 text-2xl">
                          🧑‍🔧
                        </div>
                        <p className="mt-2 text-sm font-bold text-gray-900">{p.name}</p>
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-semibold text-gray-600">{p.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom tab bar */}
          <div className="relative flex items-center justify-between border-t border-gray-100 bg-white px-5 pb-4 pt-2">
            <TabItem icon={Home} label="Home" active />
            <TabItem icon={Briefcase} label="Jobs" />
            <div className="relative -mt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/40">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <span className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500" />
            </div>
            <TabItem icon={MessageSquare} label="Messages" />
            <TabItem icon={User} label="Profile" />
          </div>
        </div>
      </div>
    </div>
  );
};

const TabItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}> = ({ icon: Icon, label, active }) => (
  <div className="flex w-12 flex-col items-center gap-0.5">
    <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : 'text-gray-400'}`} />
    <span className={`text-[9px] font-medium ${active ? 'text-orange-500' : 'text-gray-400'}`}>
      {label}
    </span>
  </div>
);

export default ClientHomePreview;
