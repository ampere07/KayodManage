import React, { useState } from 'react';
import { getPlaceholderImage } from '../../utils/imageUtils';
import FullscreenImageModal from './FullscreenImageModal';

interface ClickableImageProps {
  src: string;
  alt: string;
  className?: string;
  imageType?: 'face' | 'id' | 'credential';
  title?: string;
  showFullscreenHint?: boolean;
}

const ClickableImage: React.FC<ClickableImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  imageType = 'credential',
  title,
  showFullscreenHint = true
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(getPlaceholderImage(imageType));
    }
  };

  const handleLoad = () => {
    setHasError(false);
  };

  const openFullscreen = () => {
    setIsFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreenOpen(false);
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={openFullscreen}>
        <img
          src={imgSrc}
          alt={alt}
          className={`${className} transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg`}
          onError={handleError}
          onLoad={handleLoad}
        />
        
        {/* Overlay with zoom hint */}
        {showFullscreenHint && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
            <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm font-medium opacity-0 group-hover:opacity-100 transform scale-95 group-hover:scale-100 transition-all duration-200">
              Click to view fullscreen
            </div>
          </div>
        )}
      </div>

      <FullscreenImageModal
        isOpen={isFullscreenOpen}
        imageUrl={imgSrc}
        alt={alt}
        title={title}
        onClose={closeFullscreen}
      />
    </>
  );
};

export default ClickableImage;