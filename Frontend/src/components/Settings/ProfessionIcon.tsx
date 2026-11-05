import React, { useEffect, useState } from 'react';
import { ImageIcon, ImageOff } from 'lucide-react';
import { professionIconUrl, useIconStates } from './taxonomy';

const SIZES = {
  sm: { box: 'h-9 w-9 rounded-lg', img: 'h-7 w-7', glyph: 'h-4 w-4' },
  md: { box: 'h-11 w-11 rounded-xl', img: 'h-9 w-9', glyph: 'h-4 w-4' },
  lg: { box: 'h-20 w-20 rounded-2xl', img: 'h-16 w-16', glyph: 'h-6 w-6' },
} as const;

/**
 * A profession's icon exactly as the Kayod app loads it (taxonomy.
 * professionIconUrl). When the file isn't there the app has nothing to show,
 * so neither do we: a dashed amber placeholder makes the gap visible — and a
 * known-missing icon is never requested, so the console stays free of 404s.
 *
 * `previewSrc` shows an image chosen but not yet uploaded. With no name
 * (a profession still being named) there's nothing to look up: a neutral box.
 */
const ProfessionIcon: React.FC<{
  name: string;
  updatedAt?: string | Date | null;
  size?: keyof typeof SIZES;
  previewSrc?: string | null;
}> = ({ name, updatedAt, size = 'md', previewSrc }) => {
  const named = Boolean(name.trim());
  const url = named ? professionIconUrl(name, updatedAt) : '';
  const stateOf = useIconStates(url && !previewSrc ? [url] : []);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url, previewSrc]);
  const s = SIZES[size];

  if (previewSrc) {
    return (
      <span className={`${s.box} flex-shrink-0 flex items-center justify-center bg-orange-50`}>
        <img src={previewSrc} alt="" className={`${s.img} object-contain`} />
      </span>
    );
  }
  if (!named) {
    return (
      <span className={`${s.box} flex-shrink-0 flex items-center justify-center bg-gray-50 border border-gray-100`}>
        <ImageIcon className={`${s.glyph} text-gray-300`} />
      </span>
    );
  }
  const state = failed ? 'missing' : stateOf(url);
  if (state === 'missing') {
    return (
      <span
        className={`${s.box} flex-shrink-0 flex items-center justify-center border border-dashed border-amber-300 bg-amber-50`}
        title="No icon: the app has nothing to show for this profession"
        data-testid="profession-icon-missing"
      >
        <ImageOff className={`${s.glyph} text-amber-500`} />
      </span>
    );
  }
  if (state === 'loading') {
    return <span className={`${s.box} flex-shrink-0 bg-gray-100 animate-pulse`} data-testid="profession-icon-loading" />;
  }
  return (
    <span className={`${s.box} flex-shrink-0 flex items-center justify-center bg-orange-50`}>
      <img src={url} alt="" className={`${s.img} object-contain`} onError={() => setFailed(true)} />
    </span>
  );
};

export default ProfessionIcon;
