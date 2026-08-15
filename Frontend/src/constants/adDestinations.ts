// Destinations an admin may point an ad banner at.
//
// `value` is the EXACT React Navigation route name in the Kayod client
// (kayod/client/src/navigation/AppNavigator.jsx) and is stored verbatim in the
// advertisement's `linkAction` field.
//
// Only routes registered on AppNavigator's root stack or on MainTabNavigator are
// listed: the client dispatches the tap via navigationRef.navigate() from
// HomeScreen, which resolves a bare name against the focused navigator chain and
// its ancestors — it never descends into unfocused sibling navigators. Routes
// registered only inside ProfileStack / WorksStack / MessagesStack are therefore
// unreachable by name and are deliberately omitted in favour of their tab
// equivalents (Profile, Jobs, Messages).
//
// Also excluded: screens that need route params an admin cannot supply
// (JobDetailsScreen, ChatDetail, …), auth/onboarding screens, and dev-only
// screens.
//
// Adding a value here needs no backend deploy — the backend validates the shape
// of linkAction, not a route allow-list.

export interface AdDestination {
  value: string;
  label: string;
  group: string;
}

/** UI-only marker for the "External link" option — never stored. */
export const AD_URL_SENTINEL = '__url__';

export const AD_DESTINATIONS: AdDestination[] = [
  // Jobs
  { value: 'CreateJobScreen', label: 'Post a Job', group: 'Jobs' },
  { value: 'Jobs', label: 'My Jobs / My Works (tab)', group: 'Jobs' },
  { value: 'ArchivedJobs', label: 'Archived Jobs & Drafts', group: 'Jobs' },

  // Discover
  { value: 'AllProviders', label: 'Browse Providers', group: 'Discover' },
  { value: 'FavoriteProviders', label: 'Favorite Providers', group: 'Discover' },

  // Wallet & rewards
  { value: 'Wallet', label: 'Wallet', group: 'Wallet & rewards' },
  { value: 'WithdrawalScreen', label: 'Withdraw Funds', group: 'Wallet & rewards' },
  { value: 'CouponsScreen', label: 'Coupons', group: 'Wallet & rewards' },
  { value: 'Referrals', label: 'Refer & Earn', group: 'Wallet & rewards' },
  { value: 'PremiumScreen', label: 'Premium Upgrade', group: 'Wallet & rewards' },

  // Account
  { value: 'MyProfileScreen', label: 'My Public Profile', group: 'Account' },
  { value: 'Profile', label: 'Profile & Settings (tab)', group: 'Account' },
  { value: 'Messages', label: 'Messages (tab)', group: 'Account' },
  { value: 'Notifications', label: 'Notifications', group: 'Account' },
  { value: 'SavedAddresses', label: 'Saved Addresses', group: 'Account' },

  // Provider tools — registered for every account, but only meaningful to providers.
  { value: 'ServiceArea', label: 'Service Area', group: 'Provider tools' },
  { value: 'ProfessionSelectionScreen', label: 'Certifications', group: 'Provider tools' },
  { value: 'IdentityVerificationScreen', label: 'Identity Verification', group: 'Provider tools' },
  { value: 'VerificationScreen', label: 'Verification Wizard', group: 'Provider tools' },
  { value: 'PerformanceHistory', label: 'Performance History', group: 'Provider tools' },

  // Help & info
  { value: 'HelpCenter', label: 'Help Center', group: 'Help & info' },
  { value: 'FAQsScreen', label: 'FAQs', group: 'Help & info' },
  { value: 'ContactSupport', label: 'Contact Support', group: 'Help & info' },
  { value: 'Feedback', label: 'Send Feedback', group: 'Help & info' },
  { value: 'About', label: 'About Kayod', group: 'Help & info' },
  { value: 'PlatformPolicies', label: 'Platform Policies', group: 'Help & info' },
  { value: 'TermsOfService', label: 'Terms of Service', group: 'Help & info' },
  { value: 'PrivacyPolicy', label: 'Privacy Policy', group: 'Help & info' },
];

export const AD_DESTINATION_GROUPS = [
  'Jobs',
  'Discover',
  'Wallet & rewards',
  'Account',
  'Provider tools',
  'Help & info',
];

export const AD_DESTINATION_LABELS: Record<string, string> = Object.fromEntries(
  AD_DESTINATIONS.map((d) => [d.value, d.label]),
);

/** Max stored length — mirrors the backend cap. */
export const AD_LINK_MAX = 512;

/** linkAction is either '' | a route name | an https:// URL. */
export const isExternalLink = (v?: string) => /^https?:\/\//i.test((v || '').trim());

/** Only absolute https links are accepted (Android blocks cleartext http by default). */
export const isValidHttpsUrl = (v: string) => /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v.trim());

/**
 * Makes a pasted link storable: adds the scheme to a bare domain
 * ("kayod.ph/promo" -> "https://kayod.ph/promo") and upgrades http to https,
 * since Android blocks cleartext traffic by default. Anything that still isn't
 * a valid https URL afterwards is rejected by isValidHttpsUrl.
 */
export const normalizeAdUrl = (v: string) => {
  const s = (v || '').trim();
  if (!s) return '';
  if (/^https:\/\//i.test(s)) return s;
  if (/^http:\/\//i.test(s)) return `https://${s.slice(7)}`;
  // Bare domain — but never rewrite some other scheme (mailto:, javascript:, …)
  // into one, which would smuggle it past validation. A colon followed by digits
  // is a port ("kayod.ph:8080"), not a scheme, so that still counts as bare.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return s;
  return `https://${s}`;
};
