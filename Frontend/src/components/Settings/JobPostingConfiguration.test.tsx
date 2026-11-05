import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobPostingConfiguration from './JobPostingConfiguration';

/**
 * Settings → Configuration → Job Posting: five policy cards, each stating its
 * rules in plain words with a worked example, and one side panel per topic
 * that saves only that topic's settings.
 */

const mutate = vi.fn();
let settings: Record<string, unknown> = {};

vi.mock('../../hooks/useJobPostingSettings', () => ({
  JOB_POSTING_SETTINGS_KEY: 'job-posting-settings',
  useJobPostingSettings: () => ({ settings, isLoading: false }),
  useUpdateJobPostingSettings: () => ({ mutate, isPending: false }),
}));

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobPostingConfiguration />
    </QueryClientProvider>,
  );

const input = (name: string) => document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(input(name), { target: { value } });
const panel = () => screen.getByTestId('jp-panel');
const save = () => screen.getByTestId('jp-save') as HTMLButtonElement;

beforeEach(() => {
  mutate.mockReset();
  settings = { updatedAt: '2026-10-19T15:31:20.000Z', updatedBy: 'unknown' };
});

describe('the overview', () => {
  it('shows one card per topic, in the order a job lives through them', () => {
    renderPage();
    const titles = screen.getAllByTestId(/^jp-card-/).map((card: HTMLElement) => card.getAttribute('data-testid'));
    expect(titles).toEqual(['jp-card-posting', 'jp-card-platform', 'jp-card-clientCancel', 'jp-card-providerCancel', 'jp-card-noShow']);
  });

  it('states the rules in plain words, with the defaults filled in', () => {
    renderPage();
    expect(screen.getByTestId('jp-fact-active').textContent).toContain('5');
    expect(screen.getByTestId('jp-fact-asap').textContent).toContain('₱100');
    expect(screen.getByTestId('jp-fact-rate').textContent).toBe('Rate20%The standard 20% · Premium 15%');
    expect(screen.getByTestId('jp-example-platform').textContent).toBe('On a ₱1,000 job the platform keeps ₱200 and the provider receives ₱800.');
    expect(screen.getByTestId('jp-example-clientCancel').textContent).toBe('A ₱1,000 booking costs ₱100 to cancel before the day, ₱200 on the day.');
    expect(screen.getByTestId('jp-fact-strikes').textContent).toContain('Restricted at 4');
    expect(screen.getByTestId('jp-fact-restriction').textContent).toContain('3 missed bookings');
  });

  it('follows the saved settings', () => {
    settings = { ...settings, asapFee: 0, bookingFeePercentage: 12, bookingFeeThreshold: 800, bookingFeeMinimum: 60,
      providerCancellationFeePercentage: 0, providerCancellationFeeMinimum: 0, providerCancellationDayOfFeePercentage: 0, providerCancellationDayOfFeeMinimum: 0 };
    renderPage();
    expect(screen.getByTestId('jp-fact-asap').textContent).toContain('Free');
    expect(screen.getByTestId('jp-fact-cheaper').textContent).toBe('Cheaper jobs₱60 flatUnder ₱800');
    expect(screen.getByTestId('jp-example-providerCancel').textContent).toMatch(/cost nothing/);
  });

  it('never offers the settings the app ignores', () => {
    renderPage();
    expect(screen.queryByText(/duration|approval/i)).toBeNull();
  });

  it('does not name "unknown" as the admin who saved, and names a real one', () => {
    const { unmount } = renderPage();
    expect(screen.getByTestId('jp-updated').textContent).not.toMatch(/unknown/);
    unmount();
    settings = { ...settings, updatedBy: 'smoke.admin' };
    renderPage();
    expect(screen.getByTestId('jp-updated').textContent).toMatch(/by smoke\.admin$/);
  });
});

describe('a topic panel', () => {
  it('opens on Edit and shows only that topic', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-platform'));
    expect(screen.getByTestId('jp-panel-title').textContent).toBe('Platform fee');
    expect(input('bookingFeePercentage')).toBeTruthy();
    expect(input('asapFee')).toBeNull();
  });

  it('works the example out from the values being typed', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-platform'));
    type('bookingFeePercentage', '12');
    type('bookingFeeThreshold', '800');
    type('bookingFeeMinimum', '60');
    const rows = () => within(screen.getByTestId('jp-example-rows')).getAllByRole('listitem').map((li: HTMLElement) => li.textContent);
    expect(rows()[0]).toBe('Platform fee12% of ₱1,000₱120');
    type('examplePrice', '400');
    expect(rows()[0]).toBe('Platform feeFlat fee — under ₱800₱60');
    expect(rows()[1]).toBe('Provider receives₱340');
  });

  it('saves only its own settings', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-platform'));
    expect(save().disabled).toBe(true);
    type('bookingFeePercentage', '12');
    fireEvent.click(save());
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ bookingFeePercentage: 12, bookingFeeThreshold: 0, bookingFeeMinimum: 0 });
  });

  it('says what is wrong and keeps Save off', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-posting'));
    type('maxAttachments', '11');
    expect(within(panel()).getByTestId('jp-error').textContent).toMatch(/1 to 10/);
    expect(save().disabled).toBe(true);
    type('maxAttachments', '4');
    type('asapFee', '');
    expect(within(panel()).getByTestId('jp-error').textContent).toMatch(/Fill in every amount/);
    expect(save().disabled).toBe(true);
  });

  it('refuses a no-show reminder that would never send', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-noShow'));
    type('noShowReviewReminderHours', '48');
    expect(within(panel()).getByTestId('jp-error').textContent).toMatch(/before the window closes/);
  });

  it('shows "No fee" in the provider example once the amounts are 0', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-providerCancel'));
    for (const name of ['providerCancellationFeePercentage', 'providerCancellationFeeMinimum', 'providerCancellationDayOfFeePercentage', 'providerCancellationDayOfFeeMinimum']) type(name, '0');
    expect(screen.getByTestId('jp-example-rows').textContent).toContain('No fee');
  });

  it('can fill in the defaults without saving them', () => {
    settings = { ...settings, asapFee: 250 };
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-posting'));
    expect(input('asapFee').value).toBe('250');
    fireEvent.click(screen.getByTestId('jp-defaults'));
    expect(input('asapFee').value).toBe('100');
    expect(mutate).not.toHaveBeenCalled();
    expect(save().disabled).toBe(false);
  });

  it('Cancel closes without saving', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('jp-edit-clientCancel'));
    type('clientCancellationFeePercentage', '15');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('jp-panel')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });
});
