import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * The drawer's save path — the only place a service class is actually written.
 *
 * The picker itself is covered separately; what matters here is the payload,
 * because these are the requests that decide how long real money is held:
 *
 *   - a class change must be sent, and must NOT be sent when nothing changed
 *     (a spurious write would look like an audit event that never happened)
 *   - clearing a profession override must send an explicit `null`, not omit the
 *     field — omission leaves the old override in place, which is the silent
 *     failure this whole flow is most exposed to
 *   - the category's class is what the profession editor offers as "inherit",
 *     including the unsaved value the admin just picked
 *
 * No network: settingsService is stubbed and the assertions are on the calls.
 */

const updateJobCategory = vi.fn().mockResolvedValue({ success: true });
const updateProfession = vi.fn().mockResolvedValue({ success: true, profession: {} });
const createProfession = vi
  .fn()
  .mockResolvedValue({ success: true, profession: { _id: 'p-new', name: 'New' } });

vi.mock('../../services', () => ({
  settingsService: {
    updateJobCategory: (...args: unknown[]) => updateJobCategory(...args),
    updateProfession: (...args: unknown[]) => updateProfession(...args),
    createProfession: (...args: unknown[]) => createProfession(...args),
    deleteJobCategory: vi.fn(),
    deleteProfession: vi.fn(),
    uploadProfessionIcon: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('./TransferProfessionModal', () => ({ default: () => null }));
vi.mock('../../constants/categoryIcons', () => ({
  getDefaultIconForCategory: () => 'default',
  getIconByName: () => null,
  getProfessionIconByName: () => ({ imagePath: '/i.webp' }),
  getProfessionIconFromName: () => ({ imagePath: '/i.webp' }),
  generateProfessionIconFilename: (n: string) => `${n}.webp`,
  getAllIcons: () => [],
}));

const { default: EditCategoryDrawer } = await import('./EditCategoryDrawer');

const wellness = (professions: unknown[] = []) => ({
  _id: 'cat-1',
  name: 'Health & Wellness',
  icon: 'wellness',
  serviceClass: SERVICE_CLASS.IMMEDIATE,
  professions,
});

const renderDrawer = (category: ReturnType<typeof wellness>, profession = null) =>
  render(
    <EditCategoryDrawer
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      category={category as never}
      profession={profession}
    />,
  );

const option = (name: RegExp) => screen.getByRole('button', { name });
/** The drawer's footer commit button. */
const save = () => screen.getByRole('button', { name: /^Confirm$/ });

/**
 * The profession editor is not open on mount even when a `profession` prop is
 * given — the drawer only stages it, and the row has to be clicked to open the
 * form. Driving it the way a user does keeps the test honest about the flow.
 */
const openProfessionEditor = async (name: string) => {
  await userEvent.click(screen.getByText(name));
};

/** The override picker, scoped so it never collides with the category one. */
const overrideOption = (name: RegExp) => {
  const label = screen.getByText('Payment release override');
  return within(label.parentElement as HTMLElement).getByRole('button', { name });
};

beforeEach(() => {
  updateJobCategory.mockClear();
  updateProfession.mockClear();
  createProfession.mockClear();
});

describe('category class — save payload', () => {
  it('preselects the category’s stored class', () => {
    renderDrawer(wellness());
    expect(option(/Immediate Service/).className).toContain('border-blue-500');
  });

  it('sends the new class when it is changed', async () => {
    renderDrawer(wellness());

    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', {
      serviceClass: SERVICE_CLASS.STANDARD,
    });
  });

  it('sends nothing when the class is re-picked without changing', async () => {
    // A no-op save must not write. Otherwise every visit to the drawer looks
    // like a policy change in the audit trail.
    renderDrawer(wellness());

    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(save());

    await waitFor(() => expect(save()).toBeEnabled());
    expect(updateJobCategory).not.toHaveBeenCalled();
  });

  it('treats a category with no stored class as Standard, so switching to Immediate is a change', async () => {
    renderDrawer({ ...wellness(), serviceClass: undefined } as never);

    expect(option(/Standard Service/).className).toContain('border-blue-500');
    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', {
      serviceClass: SERVICE_CLASS.IMMEDIATE,
    });
  });

  it('sends the class alongside a rename in one request', async () => {
    renderDrawer(wellness());

    const nameInput = screen.getByPlaceholderText(/e\.g\., Automotive Services/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Wellness');
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateJobCategory).toHaveBeenCalled());
    expect(updateJobCategory).toHaveBeenCalledWith('cat-1', {
      name: 'Wellness',
      serviceClass: SERVICE_CLASS.STANDARD,
    });
  });
});

describe('profession override — save payload', () => {
  const massage = {
    _id: 'p-1',
    name: 'Massage Therapist',
    serviceClass: null,
    updatedAt: new Date('2026-01-01').toISOString(),
  };

  it('offers inherit against the category’s class', async () => {
    renderDrawer(wellness([massage]));
    await openProfessionEditor('Massage Therapist');

    const inherit = overrideOption(/Inherit from category/);
    expect(within(inherit).getByText(/Currently Immediate Service/)).toBeInTheDocument();
    expect(inherit.className).toContain('border-blue-500');
  });

  it('sends the override when one is set on an inheriting profession', async () => {
    renderDrawer(wellness([massage]));
    await openProfessionEditor('Massage Therapist');

    await userEvent.click(overrideOption(/Standard Service/));
    await userEvent.click(screen.getByRole('button', { name: /^Update$/ }));

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    expect(updateProfession).toHaveBeenCalledWith('p-1', {
      serviceClass: SERVICE_CLASS.STANDARD,
    });
  });

  it('sends an explicit null when an override is cleared', async () => {
    // The failure this guards: omitting the key leaves the override in the
    // database untouched, so "back to inherit" silently does nothing.
    const overridden = { ...massage, serviceClass: SERVICE_CLASS.STANDARD };
    renderDrawer(wellness([overridden]));
    await openProfessionEditor('Massage Therapist');

    await userEvent.click(overrideOption(/Inherit from category/));
    await userEvent.click(screen.getByRole('button', { name: /^Update$/ }));

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    const [, payload] = updateProfession.mock.calls[0];
    expect(payload).toHaveProperty('serviceClass', null);
  });

  it('does not send serviceClass when only the name changed', async () => {
    renderDrawer(wellness([massage]));
    await openProfessionEditor('Massage Therapist');

    const input = screen.getByPlaceholderText(/Edit profession name/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Masseuse');
    await userEvent.click(screen.getByRole('button', { name: /^Update$/ }));

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    expect(updateProfession).toHaveBeenCalledWith('p-1', { name: 'Masseuse' });
  });

  it('carries the override through when a new profession is added', async () => {
    renderDrawer(wellness([]));

    await userEvent.click(screen.getByRole('button', { name: /^Add$/ }));
    await userEvent.type(
      screen.getByPlaceholderText(/New profession name/i),
      'Equipment Repair',
    );
    await userEvent.click(overrideOption(/Standard Service/));
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(createProfession).toHaveBeenCalled());
    expect(createProfession).toHaveBeenCalledWith({
      name: 'Equipment Repair',
      categoryId: 'cat-1',
      serviceClass: SERVICE_CLASS.STANDARD,
    });
  });

  it('creates an inheriting profession with a null override', async () => {
    renderDrawer(wellness([]));

    await userEvent.click(screen.getByRole('button', { name: /^Add$/ }));
    await userEvent.type(screen.getByPlaceholderText(/New profession name/i), 'Masseuse');
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));

    await waitFor(() => expect(createProfession).toHaveBeenCalled());
    expect(createProfession).toHaveBeenCalledWith({
      name: 'Masseuse',
      categoryId: 'cat-1',
      serviceClass: null,
    });
  });
});
