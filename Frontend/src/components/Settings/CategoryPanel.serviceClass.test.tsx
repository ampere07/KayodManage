import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * The category panel's save path — where a category's service class is
 * written, and where a new category gets its first one.
 *
 * What matters is the payload, because these requests decide how long real
 * money is held:
 *   - a class change must be sent, and must NOT be sent when nothing changed
 *     (a spurious write would look like an audit event that never happened)
 *   - a brand-new category must start on Standard, sent explicitly — letting
 *     the field go out undefined and hoping the server picks right would put
 *     every job in it on a hold nobody chose
 *   - saving a category sends the category's own fields and nothing else; the
 *     old drawer re-saved its professions too, and overwrote their icons
 *
 * No network: settingsService is stubbed and the assertions are on the calls.
 */

const updateJobCategory = vi.fn().mockResolvedValue({ success: true });
const createJobCategory = vi.fn().mockResolvedValue({ success: true });
const createProfession = vi.fn().mockResolvedValue({ success: true, profession: { _id: 'p-new' } });

vi.mock('../../services', () => ({
  settingsService: {
    updateJobCategory: (...args: unknown[]) => updateJobCategory(...args),
    createJobCategory: (...args: unknown[]) => createJobCategory(...args),
    createProfession: (...args: unknown[]) => createProfession(...args),
    deleteJobCategory: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./ProfessionIcon', () => ({ default: () => <span /> }));

const { default: CategoryPanel } = await import('./CategoryPanel');

const wellness = (extra: Record<string, unknown> = {}) => ({
  _id: 'cat-1',
  name: 'Health & Wellness',
  serviceClass: SERVICE_CLASS.IMMEDIATE,
  professions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...extra,
});

const renderPanel = (category: unknown) =>
  render(<CategoryPanel open category={category as never} onClose={vi.fn()} onSaved={vi.fn()} onOpenProfession={vi.fn()} />);

const option = (name: RegExp) => screen.getByRole('button', { name });
const save = () => screen.getByRole('button', { name: /^Save Changes$/ });
const create = () => screen.getByRole('button', { name: /^Create category$/ });
const nameInput = () => screen.getByPlaceholderText('e.g. Home Repair');

beforeEach(() => {
  updateJobCategory.mockClear();
  createJobCategory.mockClear();
  createProfession.mockClear();
});

describe('editing a category — class payload', () => {
  it('preselects the category’s stored class', () => {
    renderPanel(wellness());
    expect(option(/Immediate Service/).className).toContain('border-blue-500');
  });

  it('sends the new class when it is changed', async () => {
    renderPanel(wellness());
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', { serviceClass: SERVICE_CLASS.STANDARD });
  });

  it('sends nothing when the class is re-picked without changing', async () => {
    renderPanel(wellness());
    await userEvent.click(option(/Immediate Service/));

    expect(save()).toBeDisabled();
    await userEvent.click(save());
    expect(updateJobCategory).not.toHaveBeenCalled();
  });

  it('treats a category with no stored class as Standard, so switching to Immediate is a change', async () => {
    renderPanel(wellness({ serviceClass: undefined }));

    expect(option(/Standard Service/).className).toContain('border-blue-500');
    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', { serviceClass: SERVICE_CLASS.IMMEDIATE });
  });

  it('sends the class alongside a rename in one request, and nothing else', async () => {
    renderPanel(wellness({ professions: [{ _id: 'p-1', name: 'Massage Therapist', serviceClass: null, updatedAt: '2026-01-01' }] }));

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Wellness');
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledTimes(1);
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', { name: 'Wellness', serviceClass: SERVICE_CLASS.STANDARD });
    expect(createProfession).not.toHaveBeenCalled();
  });

  it('adds a profession straight away, inheriting the category’s class', async () => {
    renderPanel(wellness());
    await userEvent.type(screen.getByTestId('category-add-name'), 'Masseuse');
    await userEvent.click(screen.getByTestId('category-add'));

    await waitFor(() => expect(createProfession).toHaveBeenCalled());
    expect(createProfession).toHaveBeenCalledWith({ name: 'Masseuse', categoryId: 'cat-1', serviceClass: null });
    expect(updateJobCategory).not.toHaveBeenCalled();
  });

  it('refuses a profession name already in the category', async () => {
    renderPanel(wellness({ professions: [{ _id: 'p-1', name: 'Masseuse', serviceClass: null, updatedAt: '2026-01-01' }] }));
    await userEvent.type(screen.getByTestId('category-add-name'), 'masseuse');
    await userEvent.click(screen.getByTestId('category-add'));

    expect(createProfession).not.toHaveBeenCalled();
    expect(screen.getByTestId('category-error')).toHaveTextContent('already in this category');
  });
});

describe('creating a category — default class', () => {
  it('preselects Standard, not Immediate', () => {
    renderPanel(null);
    expect(option(/Standard Service/).className).toContain('border-blue-500');
    expect(option(/Immediate Service/).className).not.toContain('border-blue-500');
  });

  it('offers no inherit option — a category has nothing to inherit from', () => {
    renderPanel(null);
    expect(screen.queryByRole('button', { name: /Inherit from category/ })).toBeNull();
  });

  it('sends Standard explicitly when nothing is touched', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Landscaping');
    await userEvent.click(create());

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Landscaping', serviceClass: SERVICE_CLASS.STANDARD }));
  });

  it('sends Immediate only when it is deliberately picked', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Wellness');
    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(create());

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Wellness', serviceClass: SERVICE_CLASS.IMMEDIATE }));
  });

  it('can be switched back to Standard before saving', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Wellness');
    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(create());

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(expect.objectContaining({ serviceClass: SERVICE_CLASS.STANDARD }));
  });

  it('sends the professions to start with', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Landscaping');
    await userEvent.type(screen.getByTestId('category-add-name'), 'Gardener{Enter}');
    await userEvent.type(screen.getByTestId('category-add-name'), 'Tree Trimmer{Enter}');
    await userEvent.click(create());

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith({
      name: 'Landscaping',
      serviceClass: SERVICE_CLASS.STANDARD,
      professions: [{ name: 'Gardener' }, { name: 'Tree Trimmer' }],
    });
    // Starting professions go with the category, not one by one.
    expect(createProfession).not.toHaveBeenCalled();
  });

  it('does not submit without a name, whatever the class', async () => {
    renderPanel(null);
    await userEvent.click(option(/Immediate Service/));

    expect(create()).toBeDisabled();
    await userEvent.click(create());
    expect(createJobCategory).not.toHaveBeenCalled();
  });

  it('states that the choice is not retroactive', () => {
    renderPanel(null);
    expect(screen.getByText(/Applies to jobs created from now on/i)).toBeInTheDocument();
  });
});
