import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * The profession panel's save path.
 *
 *   - clearing an override must send an explicit `null`, not omit the field —
 *     omission leaves the old override in place, the silent failure this flow
 *     is most exposed to
 *   - "inherit" is offered against the category's class
 *   - an icon picked here is uploaded only on Save, under the final name, so
 *     closing the panel never changes what the app shows
 *   - a move says what payment terms it ends up with, and keeps an override
 *
 * No network: settingsService is stubbed and the assertions are on the calls.
 */

const updateProfession = vi.fn().mockResolvedValue({ success: true, profession: {} });
const createProfession = vi.fn().mockResolvedValue({ success: true, profession: { _id: 'p-new', name: 'New' } });
const uploadProfessionIcon = vi.fn().mockResolvedValue({ success: true, iconName: 'ik:/professionIconsUpload/massage-therapist.webp' });
const transferProfession = vi.fn().mockResolvedValue({ success: true });
const deleteProfession = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../services', () => ({
  settingsService: {
    updateProfession: (...args: unknown[]) => updateProfession(...args),
    createProfession: (...args: unknown[]) => createProfession(...args),
    uploadProfessionIcon: (...args: unknown[]) => uploadProfessionIcon(...args),
    transferProfession: (...args: unknown[]) => transferProfession(...args),
    deleteProfession: (...args: unknown[]) => deleteProfession(...args),
  },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// The icon check isn't what these tests are about: no answer from the server.
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isLoading: false }) }));
vi.mock('./ProfessionIcon', () => ({ default: () => <span /> }));

beforeAll(() => {
  // jsdom has no object URLs; the panel previews a staged icon with one.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const { default: ProfessionPanel } = await import('./ProfessionPanel');

const wellness = {
  _id: 'cat-1',
  name: 'Health & Wellness',
  serviceClass: SERVICE_CLASS.IMMEDIATE,
  professions: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const repair = { ...wellness, _id: 'cat-2', name: 'Home Repair', serviceClass: SERVICE_CLASS.STANDARD };
const massage = {
  _id: 'p-1',
  name: 'Massage Therapist',
  categoryId: 'cat-1',
  serviceClass: null as string | null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPanel = (profession: unknown = massage, usage = { jobs: 4, activeJobs: 1, providers: 3 }) =>
  render(
    <ProfessionPanel
      open
      category={wellness as never}
      profession={profession as never}
      categories={[wellness, repair] as never}
      usage={usage}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );

const save = () => screen.getByTestId('profession-save');
const option = (name: RegExp) => screen.getByRole('button', { name });
const nameInput = () => screen.getByPlaceholderText('e.g. Auto Electrician');

beforeEach(() => {
  [updateProfession, createProfession, uploadProfessionIcon, transferProfession, deleteProfession].forEach((fn) => fn.mockClear());
});

describe('profession override — save payload', () => {
  it('offers inherit against the category’s class', () => {
    renderPanel();
    const inherit = option(/Inherit from category/);
    expect(within(inherit).getByText(/Currently Immediate Service/)).toBeInTheDocument();
    expect(inherit.className).toContain('border-blue-500');
  });

  it('sends the override when one is set on an inheriting profession', async () => {
    renderPanel();
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    expect(updateProfession).toHaveBeenCalledWith('p-1', { serviceClass: SERVICE_CLASS.STANDARD });
  });

  it('sends an explicit null when an override is cleared', async () => {
    renderPanel({ ...massage, serviceClass: SERVICE_CLASS.STANDARD });
    await userEvent.click(option(/Inherit from category/));
    await userEvent.click(save());

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    const [, payload] = updateProfession.mock.calls[0];
    expect(payload).toHaveProperty('serviceClass', null);
  });

  it('does not send serviceClass when only the name changed', async () => {
    renderPanel();
    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Masseuse');
    await userEvent.click(save());

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    expect(updateProfession).toHaveBeenCalledWith('p-1', { name: 'Masseuse' });
  });

  it('writes nothing until something changes', async () => {
    renderPanel();
    expect(save()).toBeDisabled();
    await userEvent.click(option(/Inherit from category/));
    expect(save()).toBeDisabled();
  });

  it('carries the override through when a new profession is added', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Equipment Repair');
    await userEvent.click(option(/Standard Service/));
    await userEvent.click(save());

    await waitFor(() => expect(createProfession).toHaveBeenCalled());
    expect(createProfession).toHaveBeenCalledWith({ name: 'Equipment Repair', categoryId: 'cat-1', serviceClass: SERVICE_CLASS.STANDARD });
  });

  it('creates an inheriting profession with a null override', async () => {
    renderPanel(null);
    await userEvent.type(nameInput(), 'Masseuse');
    await userEvent.click(save());

    await waitFor(() => expect(createProfession).toHaveBeenCalled());
    expect(createProfession).toHaveBeenCalledWith({ name: 'Masseuse', categoryId: 'cat-1', serviceClass: null });
  });
});

describe('icon', () => {
  const png = () => new File(['x'], 'icon.png', { type: 'image/png' });

  it('is only uploaded on save, under the final name', async () => {
    renderPanel();
    await userEvent.upload(screen.getByTestId('profession-icon-file'), png());
    expect(uploadProfessionIcon).not.toHaveBeenCalled();
    expect(screen.getByTestId('profession-icon-status')).toHaveTextContent("uploaded when you save");

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), 'Masseuse');
    await userEvent.click(save());

    await waitFor(() => expect(updateProfession).toHaveBeenCalled());
    const [file, name, oldIcon, id] = uploadProfessionIcon.mock.calls[0];
    expect([file.name, name, oldIcon, id]).toEqual(['icon.png', 'Masseuse', undefined, 'p-1']);
    // The rename carries the uploaded icon, so the server doesn't rename a file that's already right.
    expect(updateProfession).toHaveBeenCalledWith('p-1', { name: 'Masseuse', icon: 'ik:/professionIconsUpload/massage-therapist.webp' });
  });

  it('refuses a file that is not an image', async () => {
    renderPanel();
    await userEvent.upload(screen.getByTestId('profession-icon-file'), new File(['x'], 'notes.txt', { type: 'text/plain' }), { applyAccept: false });
    expect(screen.getByTestId('profession-error')).toHaveTextContent('Choose an image file');
    expect(save()).toBeDisabled();
  });

  it('says where the app looks for it', () => {
    renderPanel({ ...massage, name: 'AutoMechanic' });
    expect(screen.getByText('professionIconsUpload/auto-mechanic.webp')).toBeInTheDocument();
  });
});

describe('moving and deleting', () => {
  it('moves it, saying which payment terms it ends up with', async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByTestId('profession-move'), 'cat-2');
    expect(screen.getByTestId('profession-move-note')).toHaveTextContent("Standard Service (Home Repair's setting), not Immediate Service as now");

    await userEvent.click(save());
    await waitFor(() => expect(transferProfession).toHaveBeenCalledWith('p-1', 'cat-2'));
    expect(updateProfession).not.toHaveBeenCalled();
  });

  it('keeps its own override when moved', async () => {
    renderPanel({ ...massage, serviceClass: SERVICE_CLASS.IMMEDIATE });
    await userEvent.selectOptions(screen.getByTestId('profession-move'), 'cat-2');
    expect(screen.getByTestId('profession-move-note')).toHaveTextContent('Immediate Service (its own setting)');
  });

  it('asks before deleting, saying who uses it', async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId('profession-delete'));
    expect(screen.getByTestId('profession-delete-confirm')).toHaveTextContent('3 providers list it on their profile and 4 jobs use it');
    expect(deleteProfession).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('profession-delete-yes'));
    await waitFor(() => expect(deleteProfession).toHaveBeenCalledWith('p-1'));
  });
});
