import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SERVICE_CLASS } from '../../constants/serviceClasses';

/**
 * DOM tests for the category list's service-class surfacing, and for what the
 * redesigned list adds: the icon the app actually loads, Popular Categories
 * places, and counters that filter.
 *
 * The service-class rule is asymmetric on purpose, and that asymmetry is the
 * thing worth pinning down:
 *
 *   - Every CATEGORY shows its class, always. The taxonomy's money behaviour
 *     has to be scannable in one pass rather than discovered panel by panel.
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

/** What the backend's icon check says about every icon in a test. */
let iconAnswer: boolean | null = true;
/** Usage counts; undefined (not loaded) unless a test sets them. */
let usageAnswer: unknown = undefined;

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[1] === 'icon-check'
      ? { data: { get: () => iconAnswer }, isLoading: false }
      : { data: usageAnswer, isLoading: false },
}));

vi.mock('../../services', () => ({ settingsService: {} }));

// The panels pull in the API client; none of them take part in these rules.
vi.mock('./CategoryPanel', () => ({ default: () => null }));
vi.mock('./ProfessionPanel', () => ({ default: () => null }));
vi.mock('./PopularCategoriesPanel', () => ({ default: () => null }));

const { default: JobCategoryConfiguration } = await import('./JobCategoryConfiguration');

const profession = (
  name: string,
  serviceClass: string | null = null,
  extra: Record<string, unknown> = {},
) => ({
  _id: `prof-${name}`,
  name,
  serviceClass,
  updatedAt: new Date('2026-01-01').toISOString(),
  ...extra,
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

/** The card for a named category, including its professions. */
const categoryBlock = (name: string) =>
  screen.getByRole('heading', { name }).closest('[data-testid="category-card"]') as HTMLElement;

beforeEach(() => {
  mockUseJobCategories.mockReset();
  localStorage.clear();
  iconAnswer = true;
  usageAnswer = undefined;
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

    expect(within(categoryBlock('Legacy Category')).getByText('Standard Service')).toBeInTheDocument();
  });

  it('badges every category independently in a mixed list', () => {
    renderTree([
      category('Home Repair', SERVICE_CLASS.STANDARD),
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE),
    ]);

    expect(within(categoryBlock('Home Repair')).getByText('Standard Service')).toBeInTheDocument();
    expect(within(categoryBlock('Health & Wellness')).getByText('Immediate Service')).toBeInTheDocument();
  });
});

describe('JobCategoryConfiguration — profession override badges', () => {
  it('does not badge a profession that inherits its category', () => {
    renderTree([category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [profession('Massage Therapist', null)])]);

    const block = categoryBlock('Health & Wellness');
    expect(within(block).getByText('Massage Therapist')).toBeInTheDocument();
    // The category carries the only marker; the profession inherits silently.
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
    // One repair trade inside an on-the-spot category, flagged without
    // splitting the category. The marker is icon-only, found by its name.
    expect(within(block).getByLabelText('Standard Service')).toBeInTheDocument();
    expect(within(block).getAllByText('Immediate Service')).toHaveLength(1);
  });

  it('badges an override even when it matches the category class', () => {
    // An explicit override equal to the inherited value is still an override:
    // it will not follow the category if the category changes.
    renderTree([category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber', SERVICE_CLASS.STANDARD)])]);

    const block = categoryBlock('Home Repair');
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

describe('JobCategoryConfiguration — what the redesign adds', () => {
  it('shows the icon the app loads, built from the profession name', () => {
    // The Kayod app ignores the stored icon and asks ImageKit for the slug of
    // the NAME; previewing anything else would hide a missing icon.
    renderTree([category('Automotive', SERVICE_CLASS.STANDARD, [profession('AutoMechanic')])]);

    const img = categoryBlock('Automotive').querySelector('img') as HTMLImageElement;
    expect(img.src).toContain('/professionIconsUpload/auto-mechanic.webp?updatedAt=');
  });

  it('never requests an icon the check found missing, and says so instead', () => {
    // A request for a missing file logs a 404 in the console; the backend has
    // already asked ImageKit, so the browser doesn't have to.
    iconAnswer = false;
    renderTree([category('Automotive', SERVICE_CLASS.STANDARD, [profession('CCTV Installation')])]);

    const block = categoryBlock('Automotive');
    expect(block.querySelector('img')).toBeNull();
    expect(within(block).getByTestId('profession-icon-missing')).toBeInTheDocument();
    expect(within(block).getByTestId('profession-tile').title).toContain('No icon in the app');
    expect(screen.getByTestId('taxonomy-count-missing')).toHaveTextContent('1');
  });

  it("marks a profession's place under Popular Categories", () => {
    renderTree([
      category('Home Repair', SERVICE_CLASS.STANDARD, [
        profession('Plumber', null, { isQuickAccess: true, quickAccessOrder: 2 }),
        profession('Electrician', null, { isQuickAccess: true, quickAccessOrder: 1 }),
        profession('Painter'),
      ]),
    ]);

    const block = categoryBlock('Home Repair');
    expect(within(block).getByTitle('#2 under Popular Categories on the home screen')).toHaveTextContent('2');
    expect(within(block).getByTitle('#1 under Popular Categories on the home screen')).toHaveTextContent('1');
    expect(screen.getByTestId('taxonomy-summary')).toHaveTextContent('2 of 8 on the home screen');
  });

  it('filters to the professions a counter counts, by the class that actually applies', async () => {
    renderTree([
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [
        profession('Massage Therapist'),
        profession('Equipment Repair', SERVICE_CLASS.STANDARD),
      ]),
      category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber')]),
    ]);

    expect(screen.getByTestId('taxonomy-count-immediate')).toHaveTextContent('1');
    expect(screen.getByTestId('taxonomy-count-standard')).toHaveTextContent('2');

    await userEvent.click(screen.getByTestId('taxonomy-count-immediate'));
    expect(screen.getByText('Massage Therapist')).toBeInTheDocument();
    expect(screen.queryByText('Equipment Repair')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Home Repair' })).toBeNull();

    // Clicking the selected counter again lifts the filter.
    await userEvent.click(screen.getByTestId('taxonomy-count-immediate'));
    expect(screen.getByText('Equipment Repair')).toBeInTheDocument();
  });

  it('search narrows to matching professions, or a whole category by its name', async () => {
    renderTree([
      category('Health & Wellness', SERVICE_CLASS.IMMEDIATE, [profession('Massage Therapist'), profession('Hair Stylist')]),
      category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber')]),
    ]);

    await userEvent.type(screen.getByTestId('taxonomy-search'), 'plumb');
    expect(screen.getByText('Plumber')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Health & Wellness' })).toBeNull();

    await userEvent.clear(screen.getByTestId('taxonomy-search'));
    await userEvent.type(screen.getByTestId('taxonomy-search'), 'wellness');
    expect(screen.getByText('Massage Therapist')).toBeInTheDocument();
    expect(screen.getByText('Hair Stylist')).toBeInTheDocument();
  });

  it('keeps tiles compact: icon, name, then providers and jobs as numbers, with the rest on hover', () => {
    renderTree([
      category('Home Repair', SERVICE_CLASS.STANDARD, [
        profession('Plumber', SERVICE_CLASS.IMMEDIATE, { isQuickAccess: true, quickAccessOrder: 1 }),
      ]),
    ]);

    const tile = within(categoryBlock('Home Repair')).getByTestId('profession-tile');
    // Usage isn't loaded in these tests: the numbers wait rather than read as zero.
    expect(within(tile).getByTestId('profession-tile-providers')).toHaveTextContent('–');
    expect(within(tile).getByTestId('profession-tile-jobs')).toHaveTextContent('–');
    expect(tile.title).toContain('#1 under Popular Categories');
    expect(tile.title).toContain('Immediate Service (its own setting)');
  });

  it('spells out providers and jobs on hover, in place of the name and short counts', () => {
    usageAnswer = {
      professions: {
        'prof-Plumber': { jobs: 4, activeJobs: 2, providers: 3 },
        'prof-Painter': { jobs: 0, activeJobs: 0, providers: 0 },
      },
      categories: {},
    };
    renderTree([category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber'), profession('Painter')])]);

    const [painter, plumber] = within(categoryBlock('Home Repair')).getAllByTestId('profession-tile');
    // The resting face: name and the numbers.
    expect(within(plumber).getByTestId('profession-tile-providers')).toHaveTextContent('3');
    expect(within(plumber).getByTestId('profession-tile-jobs')).toHaveTextContent('4');
    // The hover face, swapped in by CSS (group-hover), in words.
    const hover = within(plumber).getByTestId('profession-tile-hover');
    expect(hover).toHaveTextContent('3 providers');
    expect(hover).toHaveTextContent('4 jobs · 2 active');
    expect(hover.className).toContain('group-hover:opacity-100');
    expect(within(plumber).getByTestId('profession-tile-face').className).toContain('group-hover:opacity-0');
    expect(within(painter).getByTestId('profession-tile-hover')).toHaveTextContent('No providers yetNo jobs yet');
  });

  it('says it is still counting before usage loads', () => {
    renderTree([category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber')])]);
    expect(within(categoryBlock('Home Repair')).getByTestId('profession-tile-hover')).toHaveTextContent('Counting…');
  });

  it('remembers a collapsed category', async () => {
    const { unmount } = renderTree([category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber')])]);
    await userEvent.click(screen.getByLabelText('Collapse Home Repair'));
    expect(screen.queryByText('Plumber')).toBeNull();
    unmount();

    renderTree([category('Home Repair', SERVICE_CLASS.STANDARD, [profession('Plumber')])]);
    expect(screen.queryByText('Plumber')).toBeNull();
    expect(screen.getByLabelText('Expand Home Repair')).toBeInTheDocument();
  });
});
