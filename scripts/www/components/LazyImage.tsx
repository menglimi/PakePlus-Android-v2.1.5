
import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Loader2, Film } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface LazyImageProps {
    filename?: string;
    alt?: string;
    className?: string;
    placeholder?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({ filename, alt, className, placeholder }) => {
    const { getAssetUrl } = useStore();
    const [src, setSrc] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (imgRef.current) observer.observe(imgRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (isVisible && filename) {
            setIsLoading(true);
            getAssetUrl(filename).then(url => {
                if (isMounted) {
                    setSrc(url);
                    setIsLoading(false);
                }
            });
        }
        return () => { isMounted = false; };
    }, [isVisible, filename, getAssetUrl]);

    if (!filename) {
        return (
            <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 ${className}`}>
                {placeholder || <ImageIcon size={24}/>}
            </div>
        );
    }

    const isVideo = filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.mov');

    return (
        <div ref={imgRef} className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`}>
            {!isVisible || isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 animate-pulse">
                    {isLoading ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/>}
                </div>
            ) : null}
            
            {isVisible && src && (
                isVideo ? (
                    <div className="w-full h-full relative group">
                        <video src={src} className="w-full h-full object-cover" muted loop playsInline onMouseOver={e=>e.currentTarget.play()} onMouseOut={e=>e.currentTarget.pause()}/>
                        <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><Film size={12}/></div>
                    </div>
                ) : (
                    <img src={src} alt={alt || 'asset'} className={`w-full h-full object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`} />
                )
            )}
        </div>
    );
};
