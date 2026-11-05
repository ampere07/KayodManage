import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

// List controls the Jobs, Archived Jobs and Users pages share: sortable column
// headers, the select style of their filter bars, and the page-number footer.

export const ago = (value: Date | string) => formatDistanceToNowStrict(new Date(value), { addSuffix: true });

/** Page numbers around the current one, with the first and last always shown. */
export const pageList = (page: number, pages: number): (number | '…')[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages);
  return [
    1,
    ...(around[0] > 2 ? ['…' as const] : []),
    ...around,
    ...(around[around.length - 1] < pages - 1 ? ['…' as const] : []),
    pages,
  ];
};

/** A column header that sorts the list: first click picks a direction, the next flips it. */
export const SortHeader: React.FC<{ label: string; dir: 'asc' | 'desc' | null; onClick: () => void }> = ({ label, dir, onClick }) => {
  const Arrow = dir === 'desc' ? ArrowDown : dir === 'asc' ? ArrowUp : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`sort-${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors ${dir ? 'text-gray-900' : 'hover:text-gray-900'}`}
    >
      {label}
      <Arrow className={`h-3.5 w-3.5 ${dir ? 'text-blue-600' : 'text-gray-300'}`} />
    </button>
  );
};

export const selectClass = 'w-full h-8 lg:h-9 px-2 lg:px-3 bg-white border border-gray-200 rounded-lg lg:rounded-xl shadow-sm text-[11px] lg:text-xs font-black uppercase tracking-wider text-gray-600 truncate focus:outline-none focus:ring-2 focus:ring-blue-500/20';

/** The list footer: which rows are showing, rows per page, and page numbers. */
export const ListFooter: React.FC<{
  page: number;
  limit: number;
  total: number;
  pages: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}> = ({ page, limit, total, pages, onPage, onLimit }) => (
  <div className="flex-shrink-0 bg-white border-t border-gray-200 z-10 px-4 md:px-6 font-inter h-[65px] flex items-center">
          <div className="flex items-center justify-between gap-4 w-full">
            <p className="text-xs md:text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">{((page - 1) * limit) + 1}</span>{' '}
              to{' '}
              <span className="font-medium">{Math.min(page * limit, total)}</span>{' '}
              of{' '}
              <span className="font-medium">{total}</span> results
            </p>
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
                <select
                  value={limit}
                  onChange={(e) => onLimit(Number(e.target.value))}
                  className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <nav className="flex items-center gap-1" aria-label="Pages">
                <button
                  onClick={() => onPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 md:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Previous
                </button>
                <div className="hidden md:flex items-center gap-1 mx-1">
                  {pageList(page, pages).map((p, i) => p === '…' ? (
                    <span key={`gap-${i}`} className="w-6 text-center text-sm text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === page ? 'page' : undefined}
                      onClick={() => onPage(p)}
                      className={`min-w-[2.25rem] h-9 px-2 text-sm rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => onPage(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                  className="px-3 md:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
);
