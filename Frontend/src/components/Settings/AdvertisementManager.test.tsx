import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AdvertisementManager from './AdvertisementManager';
import type { Advertisement } from '../../types/configuration.types';

/**
 * Settings → Configuration → Advertisement: the list (counters that filter,
 * search, rows), the phone preview for each home screen, and the side panel
 * that designs, aims, schedules and reports on an ad.
 */

const create = vi.fn();
const update = vi.fn();
const duplicate = vi.fn();
const remove = vi.fn();
const reorder = vi.fn();
let ads: Advertisement[] = [];

vi.mock('../../hooks/useAdvertisements', () => ({
  useAdvertisements: () => ({ advertisements: ads, isLoading: false }),
  useAdvertisementMutations: () => ({
    createAdvertisement: { mutate: create, isPending: false },
    updateAdvertisement: { mutate: update, isPending: false },
    duplicateAdvertisement: { mutate: duplicate, isPending: false },
    deleteAdvertisement: { mutate: remove, isPending: false },
    reorderAdvertisements: { mutate: reorder, isPending: false },
  }),
}));

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const stats = (views: number, taps: number) => ({
  views, taps, lastSeen: '2026-10-19',
  daily: Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(6 + i).padStart(2, '0')}`, views: i === 13 ? views : 0, taps: i === 13 ? taps : 0 })),
  byPlacement: { client_home: { views, taps }, provider_home: { views: 0, taps: 0 } },
});
const ad = (over: Partial<Advertisement>): Advertisement => ({
  _id: Math.random().toString(16).slice(2, 14).padEnd(24, '0'),
  type: 'offer', title: 'Promo', subtitle: '', highlight: '20% off', ctaLabel: '', imageUrl: '', imageFileId: '', overlays: [], linkAction: '',
  status: 'published', isActive: true, order: 0, ...over,
});

beforeEach(() => {
  [create, update, duplicate, remove, reorder].forEach((fn) => fn.mockReset());
  ads = [
    ad({ _id: 'a'.repeat(24), title: 'Rainy season', placements: ['client_home'], stats: stats(1000, 31), linkAction: 'Wallet' }),
    ad({ _id: 'b'.repeat(24), title: 'Get certified', placements: ['provider_home'], linkAction: 'ProfessionSelectionScreen' }),
    ad({ _id: 'c'.repeat(24), title: 'Christmas', startsAt: iso(5), placements: ['client_home', 'provider_home'] }),
    ad({ _id: 'd'.repeat(24), title: 'Old promo', endsAt: iso(-1) }),
    ad({ _id: 'e'.repeat(24), title: 'Idea', status: 'draft', isActive: false }),
  ];
});

const rows = () => screen.getAllByTestId('ad-row');
const rowNames = () => rows().map((r: HTMLElement) => within(r).getByTestId('ad-row-name').textContent);
const panel = () => screen.getByTestId('ad-panel');

describe('the list', () => {
  it('shows each ad with its state now and where it shows', () => {
    render(<AdvertisementManager />);
    expect(rowNames()).toEqual(['Rainy season', 'Get certified', 'Christmas', 'Old promo', 'Idea']);
    const states = rows().map((r: HTMLElement) => within(r).getAllByTestId('ad-row-state')[0].textContent);
    expect(states).toEqual(['Live', 'Live', 'Scheduled', 'Ended', 'Draft']);
    expect(within(rows()[2]).getByTestId('ad-row-placements').textContent).toBe('Client homeProvider home');
    expect(within(rows()[0]).getByTestId('ad-row-performance').textContent).toBe('1,000 views31 taps · 3.1%');
  });

  it('counters filter by state and by placement, and the search narrows them', () => {
    render(<AdvertisementManager />);
    expect(screen.getByTestId('ads-count-scheduled').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('ads-count-provider_home'));
    expect(rowNames()).toEqual(['Get certified', 'Christmas']);
    fireEvent.click(screen.getByTestId('ads-count-provider_home'));
    fireEvent.change(screen.getByTestId('ads-search'), { target: { value: 'wallet' } });
    expect(rowNames()).toEqual(['Rainy season']);
  });

  it('summarises what is showing now in each carousel', () => {
    render(<AdvertisementManager />);
    expect(screen.getByTestId('ads-summary').textContent).toContain('showing now: 1 on the client home, 1 on the provider home');
    expect(screen.getByTestId('ads-next-change').textContent).toMatch(/“Christmas” goes live/);
  });

  it('duplicates from the row menu', () => {
    render(<AdvertisementManager />);
    fireEvent.click(within(rows()[0]).getByTestId('ad-row-more'));
    fireEvent.click(screen.getByTestId('ad-row-duplicate'));
    expect(duplicate).toHaveBeenCalledWith('a'.repeat(24));
  });
});

describe('the preview', () => {
  it('fills the client carousel with the ads showing now, then the built-in slides', () => {
    render(<AdvertisementManager />);
    const slides = within(screen.getByTestId('preview-carousel-client_home')).getAllByTestId('preview-slide');
    expect(slides).toHaveLength(3); // Rainy season + the app's invite and offer slides
    expect(slides.filter((s: HTMLElement) => s.getAttribute('data-built-in') === 'true')).toHaveLength(2);
  });

  it('shows the provider home, with no carousel when nothing targets it', () => {
    ads = ads.filter((a) => !(a.placements || []).includes('provider_home'));
    render(<AdvertisementManager />);
    fireEvent.click(screen.getByTestId('ads-preview-provider_home'));
    expect(screen.getByTestId('preview-no-provider-carousel')).toBeTruthy();
  });
});

describe('the panel', () => {
  it('creates a provider ad scheduled for later, with only what was set', () => {
    render(<AdvertisementManager />);
    fireEvent.click(screen.getByTestId('ads-new'));
    fireEvent.change(within(panel()).getByPlaceholderText('Special Offer'), { target: { value: 'Boost your profile' } });
    fireEvent.click(screen.getByTestId('ad-placement-provider_home'));
    fireEvent.click(screen.getByTestId('ad-placement-client_home'));
    fireEvent.change(within(panel()).getByRole('combobox'), { target: { value: 'ProfessionSelectionScreen' } });
    fireEvent.click(screen.getByTestId('ad-start-later'));
    expect(screen.getByTestId('ad-schedule-summary').textContent).toMatch(/published now, it waits as Scheduled/);
    expect(screen.getByTestId('ad-publish').textContent).toBe('Schedule');
    fireEvent.click(screen.getByTestId('ad-publish'));
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0].data;
    expect(payload).toMatchObject({ title: 'Boost your profile', placements: ['provider_home'], linkAction: 'ProfessionSelectionScreen', status: 'published', endsAt: null });
    expect(new Date(payload.startsAt).getTime()).toBeGreaterThan(Date.now());
    expect(create.mock.calls[0][0].successMessage).toMatch(/^Scheduled/);
  });

  it('refuses an ad with no headline, no placement, or an end before its start', () => {
    render(<AdvertisementManager />);
    fireEvent.click(screen.getByTestId('ads-new'));
    fireEvent.click(screen.getByTestId('ad-placement-client_home'));
    fireEvent.click(screen.getByTestId('ad-start-later'));
    fireEvent.click(screen.getByTestId('ad-end-later'));
    const start = panel().querySelector('input[name="startsAt"]') as HTMLInputElement;
    fireEvent.change(panel().querySelector('input[name="endsAt"]') as HTMLInputElement, { target: { value: start.value.replace(/T.*/, 'T08:00') } });
    fireEvent.click(screen.getByTestId('ad-publish'));
    const message = screen.getByTestId('ad-error').textContent || '';
    expect(message).toMatch(/headline/);
    expect(message).toMatch(/at least one place/);
    expect(message).toMatch(/end must be after the start/);
    expect(create).not.toHaveBeenCalled();
  });

  it('warns when a provider ad opens a screen only clients can use', () => {
    render(<AdvertisementManager />);
    fireEvent.click(screen.getByTestId('ads-new'));
    fireEvent.click(screen.getByTestId('ad-placement-provider_home'));
    fireEvent.change(within(panel()).getByRole('combobox'), { target: { value: 'CreateJobScreen' } });
    expect(screen.getByTestId('ad-warning-audience').textContent).toMatch(/Post a Job is for clients/);
  });

  it('opens an ad with its performance, and Save stays off until something changes', () => {
    render(<AdvertisementManager />);
    fireEvent.click(within(rows()[0]).getByTestId('ad-row-edit'));
    expect(screen.getByTestId('ad-panel-title').textContent).toBe('Rainy season');
    expect(screen.getByTestId('ad-performance').textContent).toContain('3.1%');
    const save = screen.getByTestId('ad-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(panel()).getByPlaceholderText('20% off'), { target: { value: '30% off' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(update.mock.calls[0][0]).toMatchObject({ id: 'a'.repeat(24), data: { highlight: '30% off', status: 'published' } });
  });

  it('asks before throwing away changes', () => {
    render(<AdvertisementManager />);
    fireEvent.click(within(rows()[0]).getByTestId('ad-row-edit'));
    fireEvent.change(within(panel()).getByPlaceholderText('20% off'), { target: { value: '30% off' } });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('ad-discard-confirm')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ad-discard-yes'));
    expect(screen.queryByTestId('ad-panel')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
