import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * DOM tests for the category tree's service-class surfacing.
 *
 * The rule this screen encodes is asymmetric on purpose, and that asymmetry is
 * the thing worth pinning down:
 *
 *   - Every CATEGORY shows its class, always. The taxonomy's money behaviour
 *     has to be scannable in one pass rather than discovered drawer by drawer.
 *   - A PROFESSION shows a badge only when it OVERRIDES its category. Badging
 *     the inheriting majority would bury the handful of exceptions the badge
 *     exists to surface.
 *
 * Everything below the component under test is stubbed — no network, no query
 * client, no socket — so a failure here can only mean the rendering rule broke.
 */

const mockUseJobCategories = vi.fn();

vi.mock('../../hooks/useJobs', () => ({
  useJobCategories: () => mockUseJobCategories(),
}));

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Child modals pull in the API client and ImageKit; none of them participate in
// the badge rule, so they are reduced to inert markers.
vi.mock('./AddCategoryModal', () => ({ default: () => null }));
vi.mock('./EditCategoryDrawer', () => ({ default: () => null }));
vi.mock('./QuickAccessManager', () => ({ default: () => null }));

vi.mock('../../constants/categoryIcons', () => ({
  getIconByName: () => null,
  getDefaultIconForCategory: () => 'default',
  getProfessionIconByName: () => ({ imagePath: '/icon.webp' }),
  getProfessionIconFromName: () => ({ imagePath: '/icon.webp' }),
}));

const { default: JobCategoryConfiguration } = await import(
  './JobCategoryConfiguration'
);

const profession = (
  name: string,
  serviceClass: string | null = null,
) => ({
  _id: `prof-${name}`,
  name,
  serviceClass,
  updatedAt: new Date('2026-01-01').toISOString(),
});

const category = (
  name: string,
  serviceClass: string | undefined,
  professions: ReturnType<typeof profession>[] = [],
) => ({ _id: `cat-${name}`, name, serviceClass, professions });

const renderTree = (categories: unknown[], isLoading = false) => {
  mockUseJobCategories.mockReturnValue({ categories, isLoading });
  return render(<JobCategoryConfiguration />);
};

/** The row block for a named category, including its expanded professions. */
const categoryBlock = (name: string) =>
  screen.getByText(name).closest('.border-b') as HTMLElement;

beforeEach(() => {
  mockUseJobCategories.mockReset();
  localStorage.clear();
});

describe('JobCategoryConfiguration — category badges', () => {
  it('names a standard category without printing its hold length', () => {
    renderTree([category('Home Repair', SERVICE_CLASS.STANDARD)]);

    const block = categoryBlock('Home Repair');
    expect(within(block).getByText('Standard Service')).toBeInTheDocument();
    expect(within(block).queryByText(/5 days/)).toBeNull();
  });

  it('names an immediate category without printing its hold length', () => {
    renderTree([category('Health & Wellness', SERVICE_CLASS.IMMEDIATE)]);

    const block = categoryBlock('Health & Wellness');
    expect(within(block).getByText('Immediate Service')).toBeInTheDocument();
    expect(within(block).queryByText(/24 hours/)).toBeNull();
  });

  it('labels a category with no stored class as Standard rather than blank', () => {
    // Categories predating the field read as undefined; showing nothing would
    // imply "no policy", when in fact they hold for the full 5 days.
    renderTree([category('Legacy Category', undefined)]);

    expect(
      within(categoryBlock('Legacy Category')).getByText('Standard Service'),
    ).toBeInTheDocument();
  });

  it('badges every category independently in a mixed list', () => {
    renderTree([
      category('Home Repair', SERVICE_CLASS.STANDARD),
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE),
    ]);

    expect(
      within(categoryBlock('Home Repair')).getByText('Standard Service'),
    ).toBeInTheDocument();
    expect(
      within(categoryBlock('Health & Wellness')).getByText('Immediate Service'),
    ).toBeInTheDocument();
  });
});

describe('JobCategoryConfiguration — profession override badges', () => {
  it('does not badge a profession that inherits its category', () => {
    renderTree([
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [
        profession('Massage Therapist', null),
      ]),
    ]);

    const block = categoryBlock('Health & Wellness');
    expect(within(block).getByText('Massage Therapist')).toBeInTheDocument();
    // The category carries the only marker; the profession inherits silently,
    // so no icon marker appears on any tile.
    expect(within(block).getAllByText('Immediate Service')).toHaveLength(1);
    expect(within(block).queryAllByLabelText(/Service$/)).toHaveLength(0);
  });

  it('badges a profession that overrides its category', () => {
    renderTree([
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [
        profession('Massage Therapist', null),
        profession('Medical Equipment Repair', SERVICE_CLASS.STANDARD),
      ]),
    ]);

    const block = categoryBlock('Health & Wellness');
    // The override is the whole point of the feature: one repair trade inside
    // an on-the-spot category, flagged without splitting the category. The
    // tile is icon-only, so it is found by its accessible name.
    expect(within(block).getByLabelText('Standard Service')).toBeInTheDocument();
    expect(within(block).getAllByText('Immediate Service')).toHaveLength(1);
  });

  it('badges an override even when it matches the category class', () => {
    // An explicit override that happens to equal the inherited value is still
    // an override — it will not follow the category if the category changes,
    // and an admin needs to see that.
    renderTree([
      category('Home Repair', SERVICE_CLASS.STANDARD, [
        profession('Plumber', SERVICE_CLASS.STANDARD),
      ]),
    ]);

    const block = categoryBlock('Home Repair');
    // The category's labelled badge, plus one icon-only marker on the tile.
    expect(within(block).getAllByText('Standard Service')).toHaveLength(1);
    expect(within(block).getAllByLabelText('Standard Service')).toHaveLength(1);
  });

  it('flags only the overriding professions when several inherit', () => {
    renderTree([
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [
        profession('Massage Therapist', null),
        profession('Hair Stylist', null),
        profession('Nail Technician', null),
        profession('Equipment Repair', SERVICE_CLASS.STANDARD),
      ]),
    ]);

    const block = categoryBlock('Health & Wellness');
    expect(within(block).getAllByLabelText('Standard Service')).toHaveLength(1);
    expect(within(block).getAllByText('Immediate Service')).toHaveLength(1);
  });
});

describe('JobCategoryConfiguration — non-badge states', () => {
  it('shows a spinner and no badges while loading', () => {
    renderTree([], true);

    expect(screen.queryByText('Standard Service')).toBeNull();
    expect(screen.queryByText('Immediate Service')).toBeNull();
  });

  it('shows the empty state and no badges with no categories', () => {
    renderTree([]);

    expect(screen.getByText('No categories found')).toBeInTheDocument();
    expect(screen.queryByText('Standard Service')).toBeNull();
  });

  it('keeps the category badge visible for a category with no professions', () => {
    renderTree([category('Empty Category', SERVICE_CLASS.IMMEDIATE, [])]);

    const block = categoryBlock('Empty Category');
    expect(within(block).getByText('Immediate Service')).toBeInTheDocument();
    expect(within(block).getByText(/No professions yet/)).toBeInTheDocument();
  });
});
