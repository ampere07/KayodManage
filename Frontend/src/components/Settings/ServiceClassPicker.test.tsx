import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ServiceClassPicker, { ServiceClassBadge } from './ServiceClassPicker';
import { SERVICE_CLASS, type ServiceClassId } from '../../constants/serviceClasses';

/**
 * DOM tests for the control that assigns a job category's payment-release
 * class. This picker is the only place in either app where a human decides how
 * long real money is held, so the branches that matter are:
 *
 *   - category mode vs profession mode (inherit offered or not)
 *   - which option reads as selected, for every value including null,
 *     undefined, and values this build does not recognise
 *   - what onChange actually emits — an id, or null to clear an override
 *   - that the "existing jobs are unaffected" note is always present, because
 *     its absence would make this control read as retroactive
 */

const getOption = (name: RegExp | string) =>
  screen.getByRole('button', { name });

const isSelected = (element: HTMLElement) =>
  element.className.includes('border-blue-500');

describe('ServiceClassPicker — category mode', () => {
  it('offers every known class and no inherit option', () => {
    render(<ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={vi.fn()} />);

    expect(getOption(/Standard Service/)).toBeInTheDocument();
    expect(getOption(/Immediate Service/)).toBeInTheDocument();
    // A category has nothing to inherit from — offering it would let an admin
    // save a category with no class at all.
    expect(screen.queryByRole('button', { name: /Inherit from category/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('marks only the current class as selected', () => {
    render(<ServiceClassPicker value={SERVICE_CLASS.IMMEDIATE} onChange={vi.fn()} />);

    expect(isSelected(getOption(/Immediate Service/))).toBe(true);
    expect(isSelected(getOption(/Standard Service/))).toBe(false);
  });

  it('states each class’s hold length in prose, since this is where it is chosen', () => {
    // The picker is the one surface that spells the window out. Badges
    // elsewhere name the class only — the window is what happens to differ
    // between classes today, not what a class IS.
    render(<ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={vi.fn()} />);

    expect(within(getOption(/Standard Service/)).getByText('5 days')).toBeInTheDocument();
    expect(within(getOption(/Immediate Service/)).getByText(/released as soon as/)).toBeInTheDocument();
  });

  it('emits the class id when a different option is picked', async () => {
    const onChange = vi.fn();
    render(<ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={onChange} />);

    await userEvent.click(getOption(/Immediate Service/));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(SERVICE_CLASS.IMMEDIATE);
  });

  it('still emits when the already-selected option is re-clicked', async () => {
    // The parent decides whether that is a no-op; the control must not silently
    // swallow the interaction, or a mis-wired parent looks like a dead button.
    const onChange = vi.fn();
    render(<ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={onChange} />);

    await userEvent.click(getOption(/Standard Service/));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(SERVICE_CLASS.STANDARD);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an unrecognised class', 'overnight-express'],
  ])('falls back to Standard when the stored value is %s', (_label, value) => {
    // Guessing wrong must delay a payout, never release one early — so an
    // unreadable value has to land on the longest hold, not the shortest.
    render(<ServiceClassPicker value={value as ServiceClassId} onChange={vi.fn()} />);

    expect(isSelected(getOption(/Standard Service/))).toBe(true);
    expect(isSelected(getOption(/Immediate Service/))).toBe(false);
  });

  it('always states that the change is not retroactive', () => {
    render(<ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={vi.fn()} />);

    expect(
      screen.getByText(/Applies to jobs created from now on/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/keep the terms their clients agreed to at booking/i),
    ).toBeInTheDocument();
  });

  it('blocks interaction when disabled', async () => {
    const onChange = vi.fn();
    render(
      <ServiceClassPicker
        value={SERVICE_CLASS.STANDARD}
        onChange={onChange}
        disabled
      />,
    );

    const immediate = getOption(/Immediate Service/);
    expect(immediate).toBeDisabled();
    await userEvent.click(immediate);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the caller’s label when one is given', () => {
    const { rerender } = render(
      <ServiceClassPicker value={SERVICE_CLASS.STANDARD} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Payment release')).toBeInTheDocument();

    rerender(
      <ServiceClassPicker
        value={SERVICE_CLASS.STANDARD}
        onChange={vi.fn()}
        label="Payment release override"
      />,
    );
    expect(screen.getByText('Payment release override')).toBeInTheDocument();
  });
});

describe('ServiceClassPicker — profession mode (allowInherit)', () => {
  it('adds an inherit option that names the class it would fall back to', () => {
    render(
      <ServiceClassPicker
        value={null}
        onChange={vi.fn()}
        allowInherit
        inheritedFrom={SERVICE_CLASS.IMMEDIATE}
      />,
    );

    const inherit = getOption(/Inherit from category/);
    // Naming the inherited class matters: "Inherit" alone gives the admin no
    // way to know what they are inheriting without leaving the drawer.
    // The duration is deliberately absent — the name identifies the class.
    expect(within(inherit).getByText(/Currently Immediate Service/)).toBeInTheDocument();
    expect(within(inherit).queryByText(/24 hours/)).toBeNull();
  });

  it('selects inherit when the profession has no override', () => {
    render(
      <ServiceClassPicker
        value={null}
        onChange={vi.fn()}
        allowInherit
        inheritedFrom={SERVICE_CLASS.STANDARD}
      />,
    );

    expect(isSelected(getOption(/Inherit from category/))).toBe(true);
    expect(isSelected(getOption(/^Standard Service/))).toBe(false);
  });

  it('selects the override, not inherit, when one is set', () => {
    render(
      <ServiceClassPicker
        value={SERVICE_CLASS.STANDARD}
        onChange={vi.fn()}
        allowInherit
        inheritedFrom={SERVICE_CLASS.IMMEDIATE}
      />,
    );

    // The override happens to be the default class while the category is the
    // non-default one — the trap case where a naive "is this standard?" check
    // would wrongly show inherit.
    expect(isSelected(getOption(/^Standard Service/))).toBe(true);
    expect(isSelected(getOption(/Inherit from category/))).toBe(false);
  });

  it('emits null when inherit is chosen, so the override is actually cleared', async () => {
    const onChange = vi.fn();
    render(
      <ServiceClassPicker
        value={SERVICE_CLASS.IMMEDIATE}
        onChange={onChange}
        allowInherit
        inheritedFrom={SERVICE_CLASS.STANDARD}
      />,
    );

    await userEvent.click(getOption(/Inherit from category/));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('treats an undefined inheritedFrom as Standard', () => {
    render(<ServiceClassPicker value={null} onChange={vi.fn()} allowInherit />);

    expect(
      within(getOption(/Inherit from category/)).getByText(/Currently Standard Service/),
    ).toBeInTheDocument();
  });

  it('round-trips override → inherit → override through real clicks', async () => {
    function Harness() {
      const [value, setValue] = useState<ServiceClassId | null>(null);
      return (
        <ServiceClassPicker
          value={value}
          onChange={setValue}
          allowInherit
          inheritedFrom={SERVICE_CLASS.STANDARD}
        />
      );
    }
    render(<Harness />);

    expect(isSelected(getOption(/Inherit from category/))).toBe(true);

    await userEvent.click(getOption(/Immediate Service/));
    expect(isSelected(getOption(/Immediate Service/))).toBe(true);
    expect(isSelected(getOption(/Inherit from category/))).toBe(false);

    await userEvent.click(getOption(/Inherit from category/));
    expect(isSelected(getOption(/Inherit from category/))).toBe(true);
    expect(isSelected(getOption(/Immediate Service/))).toBe(false);
  });
});

describe('ServiceClassBadge', () => {
  it('names the class without printing a duration', () => {
    // A badge reading "Immediate Service · 24 hours" teaches everyone that the
    // class IS its payout window. It is not: the window is merely the only
    // thing separating the classes today, and a future class differing some
    // other way would make every such label wrong.
    render(<ServiceClassBadge value={SERVICE_CLASS.IMMEDIATE} />);

    expect(screen.getByText('Immediate Service')).toBeInTheDocument();
    expect(screen.queryByText(/24 hours/)).toBeNull();
  });

  it('renders the standard class the same way', () => {
    render(<ServiceClassBadge value={SERVICE_CLASS.STANDARD} />);

    expect(screen.getByText('Standard Service')).toBeInTheDocument();
    expect(screen.queryByText(/5 days/)).toBeNull();
  });

  it('renders icon-only for dense rows, keeping the name accessible', () => {
    // The profession tiles are ~96px wide and cannot carry a label, but the
    // class must still be identifiable on hover and to a screen reader.
    const { container } = render(
      <ServiceClassBadge value={SERVICE_CLASS.IMMEDIATE} iconOnly />,
    );

    expect(screen.queryByText('Immediate Service')).toBeNull();
    expect(screen.getByLabelText('Immediate Service')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('carries an icon in the labelled variant too', () => {
    const { container } = render(<ServiceClassBadge value={SERVICE_CLASS.STANDARD} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('hides the standard class under onlyWhenNotable, but never the immediate one', () => {
    // Dense lists flag exceptions only — badging every inheriting row would
    // bury the ones that actually differ.
    const { container, rerender } = render(
      <ServiceClassBadge value={SERVICE_CLASS.STANDARD} onlyWhenNotable />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<ServiceClassBadge value={SERVICE_CLASS.IMMEDIATE} onlyWhenNotable />);
    expect(screen.getByText('Immediate Service')).toBeInTheDocument();
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an unrecognised class', 'weekly'],
  ])('falls back to Standard for %s', (_label, value) => {
    render(<ServiceClassBadge value={value as string} />);
    expect(screen.getByText('Standard Service')).toBeInTheDocument();
  });

  it('hides an unrecognised class under onlyWhenNotable rather than flagging it', () => {
    // It normalises to standard, so it is not an exception worth surfacing.
    const { container } = render(<ServiceClassBadge value="weekly" onlyWhenNotable />);
    expect(container).toBeEmptyDOMElement();
  });

  it('carries the class description as a tooltip', () => {
    render(<ServiceClassBadge value={SERVICE_CLASS.IMMEDIATE} />);

    expect(screen.getByTitle(/delivered and judged on the spot/i)).toBeInTheDocument();
  });
});
