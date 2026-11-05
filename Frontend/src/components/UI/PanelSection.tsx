import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The standard section of a details side panel: a small icon, a short label,
 * and a one-line description of what the section answers, then its content.
 * Sections stack with a divider between them.
 *
 * Keep labels to a word or two (People, Job details, Timeline, Location) and
 * descriptions to a short plain sentence ("Who posted it and who's doing it").
 * The job and transaction panels use it; new details panels should too.
 */
const PanelSection: React.FC<{
  icon: LucideIcon;
  label: string;
  description: string;
  testId?: string;
  /** The panel's last section: no divider under it. */
  last?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, label, description, testId, last, children }) => (
  <section className={`px-5 md:px-6 py-5 ${last ? '' : 'border-b border-gray-100'}`} data-testid={testId}>
    <header className="flex items-center gap-2.5 mb-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-gray-600" />
      </span>
      <div className="min-w-0">
        <h4 className="text-[13px] font-bold text-gray-900 leading-tight">{label}</h4>
        <p className="text-[11px] text-gray-500 leading-tight truncate">{description}</p>
      </div>
    </header>
    {children}
  </section>
);

export default PanelSection;
