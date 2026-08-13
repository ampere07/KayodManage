import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * Creating a category.
 *
 * One rule carries the risk here: a brand-new category must start on Standard.
 * Defaulting the other way — or letting the field go out undefined and hoping
 * the server picks right — would put every job in a fresh category on a
 * 24-hour hold that nobody chose. So the default is asserted both in the UI and
 * in the payload that actually leaves.
 */

const createJobCategory = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../services', () => ({
  settingsService: {
    createJobCategory: (...args: unknown[]) => createJobCategory(...args),
  },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('../SideModal', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

const { default: AddCategoryModal } = await import('./AddCategoryModal');

const renderModal = () =>
  render(<AddCategoryModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

const option = (name: RegExp) => screen.getByRole('button', { name });

const fillName = async (name: string) =>
  userEvent.type(screen.getByPlaceholderText(/e\.g\., Electrical, IT, Construction/i), name);

const submit = async () =>
  userEvent.click(screen.getByRole('button', { name: /^Add Category$/i }));

beforeEach(() => createJobCategory.mockClear());

describe('default class', () => {
  it('preselects Standard, not Immediate', () => {
    renderModal();

    expect(option(/Standard Service/).className).toContain('border-blue-500');
    expect(option(/Immediate Service/).className).not.toContain('border-blue-500');
  });

  it('offers no inherit option — a category has nothing to inherit from', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /Inherit from category/ })).toBeNull();
  });

  it('sends Standard explicitly when nothing is touched', async () => {
    renderModal();
    await fillName('Landscaping');
    await submit();

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Landscaping', serviceClass: SERVICE_CLASS.STANDARD }),
    );
  });
});

describe('choosing Immediate', () => {
  it('is a deliberate act that reaches the payload', async () => {
    renderModal();
    await fillName('Wellness');
    await userEvent.click(option(/Immediate Service/));
    await submit();

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Wellness', serviceClass: SERVICE_CLASS.IMMEDIATE }),
    );
  });

  it('can be switched back to Standard before saving', async () => {
    renderModal();
    await fillName('Wellness');
    await userEvent.click(option(/Immediate Service/));
    await userEvent.click(option(/Standard Service/));
    await submit();

    await waitFor(() => expect(createJobCategory).toHaveBeenCalled());
    expect(createJobCategory).toHaveBeenCalledWith(
      expect.objectContaining({ serviceClass: SERVICE_CLASS.STANDARD }),
    );
  });
});

describe('guards', () => {
  it('does not submit without a name, whatever the class', async () => {
    renderModal();
    await userEvent.click(option(/Immediate Service/));
    await submit();

    expect(createJobCategory).not.toHaveBeenCalled();
  });

  it('states that the choice is not retroactive', () => {
    renderModal();
    expect(screen.getByText(/Applies to jobs created from now on/i)).toBeInTheDocument();
  });
});
