import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * The terms line on the admin escrow card.
 *
 * This is what a support agent reads while deciding a dispute, so it has to
 * show the terms THIS job was booked under — its own snapshot — rather than the
 * category's current setting, which may have been changed since. Showing the
 * live category value would have an agent adjudicating against a policy the
 * client never agreed to.
 */

const jobsService = {
  updateJobStatus: vi.fn(),
  hideJob: vi.fn(),
  deleteJob: vi.fn(),
  restoreJob: vi.fn(),
  forceCancelJob: vi.fn(),
  resolveDispute: vi.fn(),
};

vi.mock('../../services', () => ({ jobsService }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('../UI/VerificationStatusBadge', () => ({ default: () => null }));
vi.mock('../UI/UserTypeBadge', () => ({ default: () => null }));
vi.mock('../UI/ClickableImage', () => ({ default: () => null }));
vi.mock('../Layout/Layout', () => ({ SidebarContext: React.createContext({ isCollapsed: false }) }));

const { default: JobDetailsModal } = await import('./JobDetailsModal');

const baseJob = {
  _id: 'job-1',
  title: 'Full body massage',
  description: '90 minutes, at home',
  status: 'completed',
  budget: 1500,
  media: [],
  createdAt: '2026-03-01T09:00:00.000Z',
  escrowStatus: 'pending',
  escrowReleaseAt: '2026-03-02T09:00:00.000Z',
  user: { _id: 'c1', name: 'Client' },
  applications: [],
};

// The modal takes the job as a prop rather than fetching it, so the tests hand
// it straight in — no network stub is involved in what is being asserted.
const renderModal = (job: Record<string, unknown>) =>
  render(<JobDetailsModal isOpen onClose={vi.fn()} job={{ ...baseJob, ...job } as never} />);

const termsLine = () => screen.getByTestId('admin-job-service-class').textContent;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('escrow terms line', () => {
  it('names an immediate job’s 24-hour hold', async () => {
    renderModal({ serviceClass: SERVICE_CLASS.IMMEDIATE, paymentReleaseHours: 24 });
    expect(termsLine()).toContain('Immediate Service');
    expect(termsLine()).toContain('24 hours');
  });

  it('names a standard job’s 5-day hold', async () => {
    renderModal({ serviceClass: SERVICE_CLASS.STANDARD, paymentReleaseHours: 120 });
    expect(termsLine()).toContain('Standard Service');
    expect(termsLine()).toContain('5 days');
  });

  it('prefers the job’s snapshot over the class default', async () => {
    // Booked when `immediate` meant 72h. The agent must see 3 days, because
    // that is the deal this client actually agreed to.
    renderModal({ serviceClass: SERVICE_CLASS.IMMEDIATE, paymentReleaseHours: 72 });
    expect(termsLine()).toContain('Immediate Service');
    expect(termsLine()).toContain('3 days');
  });

  it('falls back to the class default when the job has no snapshot', async () => {
    renderModal({ serviceClass: SERVICE_CLASS.IMMEDIATE, paymentReleaseHours: undefined });
    expect(termsLine()).toContain('24 hours');
  });

  it('reads a job predating the feature as Standard, never blank', async () => {
    renderModal({ serviceClass: undefined, paymentReleaseHours: undefined });
    const text = termsLine();
    expect(text).toContain('Standard Service');
    expect(text).toContain('5 days');
    expect(text).not.toContain('undefined');
  });

  it('normalises an unrecognised class rather than printing it raw', async () => {
    renderModal({ serviceClass: 'overnight', paymentReleaseHours: undefined });
    const text = termsLine();
    expect(text).toContain('Standard Service');
    expect(text).not.toContain('overnight');
  });

  it('shows alongside the escrow status and release date', async () => {
    renderModal({ serviceClass: SERVICE_CLASS.IMMEDIATE, paymentReleaseHours: 24 });
    expect(screen.getByTestId('admin-job-escrow-status')).toBeInTheDocument();
    expect(screen.getByTestId('admin-job-escrow-release-date')).toBeInTheDocument();
    expect(screen.getByTestId('admin-job-service-class')).toBeInTheDocument();
  });

  it('is absent entirely when there is no escrow on the job', async () => {
    // No money held, no terms to state — the whole card is hidden.
    renderModal({ escrowStatus: 'none', escrowReleaseAt: null });
    // The modal itself still rendered (the title appears in both the header and
    // the body), so the missing terms line is a real absence, not a dead mount.
    expect(screen.getAllByText('Full body massage').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('admin-job-service-class')).toBeNull();
    expect(screen.queryByTestId('admin-job-escrow-card')).toBeNull();
  });
});
