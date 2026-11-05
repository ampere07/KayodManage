import React from 'react';
import { AlertCircle, Loader2, MousePointerClick, Trash2, Type, Upload } from 'lucide-react';
import type { AdOverlay, AdOverlayPosition } from '../../../types/configuration.types';

// The five anchor points laid out as they sit on the banner, so picking one is
// a matter of pointing at the corner rather than reading a dropdown.
const POSITION_CELLS: (AdOverlayPosition | null)[] = [
  'top-left', null, 'top-right',
  null, 'center', null,
  'bottom-left', null, 'bottom-right',
];
export const POSITION_LABELS: Record<AdOverlayPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  center: 'Center',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

export const genOverlayId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const ErrorText: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-red-600" data-testid={testId}>
    <AlertCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
    <span>{children}</span>
  </p>
);

/** Upload zone that becomes a thumbnail + replace/remove once an image is set. */
export const ImagePicker: React.FC<{
  imageUrl?: string;
  uploading: boolean;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hint?: string;
  error?: string;
  compact?: boolean;
  testId?: string;
}> = ({ imageUrl, uploading, onSelect, onClear, hint, error, compact, testId = 'ad-image' }) => {
  if (imageUrl) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2" data-testid={`${testId}-set`}>
        <img src={imageUrl} alt="" className="h-12 w-20 flex-shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-800">Image added</p>
          {hint ? <p className="truncate text-[11px] text-gray-500">{hint}</p> : null}
        </div>
        <label className="cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50">
          {uploading ? 'Uploading…' : 'Replace'}
          <input type="file" accept="image/*" className="hidden" onChange={onSelect} disabled={uploading} data-testid={`${testId}-input`} />
        </label>
        <button type="button" onClick={onClear} title="Remove image" aria-label="Remove image" className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm transition-colors ${
          error ? 'border-red-300 bg-red-50/40 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
        } ${compact ? 'px-4 py-3' : 'px-4 py-7'}`}
        data-testid={`${testId}-empty`}
      >
        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-gray-400" />}
        <span className="font-medium">{uploading ? 'Uploading…' : 'Click to upload an image'}</span>
        {!compact && !uploading ? <span className="text-xs text-gray-400">Wide images work best · max 5 MB</span> : null}
        <input type="file" accept="image/*" className="hidden" onChange={onSelect} disabled={uploading} data-testid={`${testId}-input`} />
      </label>
      {error ? <ErrorText testId={`${testId}-error`}>{error}</ErrorText> : hint ? <p className="mt-1.5 text-[11px] text-gray-400">{hint}</p> : null}
    </>
  );
};

/** One text/button element layered on an image ad. */
export const OverlayEditor: React.FC<{
  overlay: AdOverlay;
  onChange: (patch: Partial<AdOverlay>) => void;
  onRemove: () => void;
}> = ({ overlay, onChange, onRemove }) => {
  const isButton = overlay.kind === 'button';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3" data-testid="ad-overlay">
      <div className="flex items-center gap-2">
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
          {isButton ? <MousePointerClick className="h-3 w-3" /> : <Type className="h-3 w-3" />}
          {isButton ? 'Button' : 'Text'}
        </span>
        <input
          type="text"
          value={overlay.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={isButton ? 'Shop now' : 'Your text'}
          aria-label={isButton ? 'Button text' : 'Overlay text'}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button type="button" onClick={onRemove} title="Remove" aria-label="Remove" className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-5">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-gray-500">Position on the image</p>
          <div className="grid w-[74px] grid-cols-3 gap-1">
            {POSITION_CELLS.map((cell, i) =>
              cell ? (
                <button
                  key={cell}
                  type="button"
                  title={POSITION_LABELS[cell]}
                  aria-label={POSITION_LABELS[cell]}
                  aria-pressed={overlay.position === cell}
                  onClick={() => onChange({ position: cell })}
                  className={`h-5 w-5 rounded transition-colors ${overlay.position === cell ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-gray-200 hover:bg-gray-300'}`}
                />
              ) : (
                <span key={`gap-${i}`} className="h-5 w-5 rounded bg-gray-50" />
              ),
            )}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-gray-500">Text colour</span>
          <input type="color" value={overlay.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-gray-200 bg-transparent p-0" />
        </label>
        {isButton ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-gray-500">Button colour</span>
            <input type="color" value={overlay.bgColor || '#E37F0D'} onChange={(e) => onChange({ bgColor: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-gray-200 bg-transparent p-0" />
          </label>
        ) : null}
      </div>
    </div>
  );
};
