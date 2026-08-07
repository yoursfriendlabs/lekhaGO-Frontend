import { useState, useRef, useEffect } from 'react';
import { Dialog } from './ui/Dialog.tsx';
import { useI18n } from '../lib/i18n.jsx';
import { ZoomIn, RotateCw, Check, X } from 'lucide-react';

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onCrop,
  aspectRatio = 1, // Default to 1:1 square crop
  outputWidth = 500, // Default output resolution width
  outputHeight = 500, // Default output resolution height
}) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Viewport size for the cropper UI
  const viewportSize = 300;

  // Reset states when modal opens/changes image
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(false);
    }
  }, [isOpen, imageSrc]);

  // Check if image is already loaded/cached (forces preview state sync)
  useEffect(() => {
    if (isOpen && imageSrc && imgRef.current) {
      if (imgRef.current.complete && imgRef.current.naturalWidth) {
        handleImageLoad({ target: imgRef.current });
      }
    }
  }, [isOpen, imageSrc, imgLoaded]);

  const handleImageLoad = (e) => {
    const img = e.target;
    setDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setImgLoaded(true);
  };

  // Calculate cover dimensions
  const getCoverDimensions = () => {
    if (!dimensions.width || !dimensions.height) return { w: 0, h: 0 };
    
    // Fit the image to cover a viewport of viewportSize x viewportSize
    const scaleCover = Math.max(viewportSize / dimensions.width, viewportSize / dimensions.height);
    return {
      w: dimensions.width * scaleCover,
      h: dimensions.height * scaleCover,
      scaleCover,
    };
  };

  const { w: baseWidth, h: baseHeight } = getCoverDimensions();

  // Mouse & Touch Drag Handlers
  const handleDragStart = (clientX, clientY) => {
    if (!imgLoaded) return;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setDragStartOffset({ x: offset.x, y: offset.y });
  };

  const handleDragMove = (clientX, clientY) => {
    if (!isDragging) return;
    
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;

    // Rotate screen drag delta by negative rotation angle to match rotated image coordinate system
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dox = dx * cos - dy * sin;
    const doy = dx * sin + dy * cos;

    setOffset({
      x: dragStartOffset.x + dox,
      y: dragStartOffset.y + doy,
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    handleDragMove(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomChange = (e) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleSave = () => {
    if (!imgLoaded || !imgRef.current) return;

    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background fill (white in case image has transparency)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    const canvasScale = outputWidth / viewportSize;

    // cover base size calculations
    const scaleCover = Math.max(viewportSize / dimensions.width, viewportSize / dimensions.height);
    const wCanvas = dimensions.width * scaleCover * canvasScale;
    const hCanvas = dimensions.height * scaleCover * canvasScale;

    // 1. Translate to center of output canvas
    ctx.translate(outputWidth / 2, outputHeight / 2);

    // 2. Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // 3. Apply drag translation
    ctx.translate(offset.x * canvasScale, offset.y * canvasScale);

    // 4. Draw image centered
    const drawWidth = wCanvas * zoom;
    const drawHeight = hCanvas * zoom;

    ctx.drawImage(
      img,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    // Convert to JPEG blob for high compression and quality
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Wrap blob in a File object
          const file = new File([blob], 'cropped-product-image.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          onCrop(file);
        }
      },
      'image/jpeg',
      0.85 // High quality, compact size
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('common.cropImage') || 'Crop & Resize Image'}
      size="md"
    >
      <div className="flex flex-col items-center gap-6 py-4">
        {/* Viewport Cropping Area */}
        <div
          ref={containerRef}
          className="relative overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-900/10 dark:bg-slate-950 shadow-inner flex items-center justify-center cursor-move"
          style={{ width: `${viewportSize}px`, height: `${viewportSize}px` }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleDragEnd}
        >
          {imageSrc && (
            <img
              ref={imgRef}
              src={imageSrc}
              alt="To Crop"
              onLoad={handleImageLoad}
              className="absolute select-none pointer-events-none transition-transform duration-75"
              style={{
                width: baseWidth ? `${baseWidth}px` : 'auto',
                height: baseHeight ? `${baseHeight}px` : 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                transform: `translate(-50%, -50%) rotate(${rotation}deg) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                left: '50%',
                top: '50%',
                opacity: imgLoaded ? 1 : 0,
              }}
            />
          )}
          {/* Subtle Crop Border Overlay */}
          <div className="absolute inset-0 pointer-events-none border-2 border-white/60 dark:border-white/40 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"></div>
        </div>

        {/* Zoom & Rotation Controls */}
        <div className="w-full max-w-xs space-y-4">
          <div className="flex items-center gap-3">
            <ZoomIn className="text-slate-400 shrink-0" size={16} />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={handleZoomChange}
              disabled={!imgLoaded}
              className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-xs font-semibold text-slate-500 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleRotate}
              disabled={!imgLoaded}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 transition disabled:opacity-50"
            >
              <RotateCw size={14} />
              Rotate 90°
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2">
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1 px-4 py-2"
            onClick={onClose}
          >
            <X size={15} />
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1 px-5 py-2"
            onClick={handleSave}
            disabled={!imgLoaded}
          >
            <Check size={15} />
            {t('common.cropAndSave') || 'Crop & Save'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
