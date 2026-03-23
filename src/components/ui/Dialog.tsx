import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    closeOnOverlayClick?: boolean;
    footer?: React.ReactNode;
}

export const Dialog = ({
                           isOpen,
                           onClose,
                           title,
                           children,
                           size = 'md',
                           showCloseButton = true,
                           closeOnOverlayClick = true,
                           footer,
                       }: DialogProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when dialog is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-2xl',
        full: 'max-w-6xl',
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[999] flex items-end justify-center overflow-y-auto bg-black/50 backdrop-blur-sm md:items-center md:p-4"
            onClick={handleOverlayClick}
        >
            <div
                ref={dialogRef}
                className={`relative w-full ${sizeClasses[size]} max-h-[90vh] rounded-t-3xl bg-white shadow-2xl md:rounded-3xl flex flex-col`}
            >
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
                        {title && <h2 className="font-serif text-xl text-slate-900">{title}</h2>}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                                aria-label="Close dialog"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

                {footer && (
                    <div className="border-t border-slate-200/70 bg-white/95 p-4 backdrop-blur flex gap-2 justify-end">{footer}</div>
                )}
            </div>
        </div>,
        document.body
    );
};
