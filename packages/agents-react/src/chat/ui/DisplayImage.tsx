import { useEffect, useState, type ComponentProps } from 'react';
import { imageDocumentForDisplay, imageForDisplay } from '../image-display';

type ImageProps = ComponentProps<'img'>;

/** An image with a HEIC/HEIF fallback for browsers without a native decoder. Remote sources must allow cross-origin reads. */
export function DisplayImage({ src, onError, ...props }: ImageProps) {
    return <ImageSource key={typeof src === 'string' ? src : undefined} {...props} src={src} onError={onError} />;
}

function ImageSource({ src, onError, ...props }: ImageProps) {
    const [retry, setRetry] = useState<string | null>(null);
    const [decoded, setDecoded] = useState<{ source: string; url: string } | null>(null);
    const converted = decoded !== null && decoded.source === src ? decoded.url : null;

    useEffect(() => {
        if (typeof src !== 'string' || retry !== src) {
            return;
        }

        let cancelled = false;
        let url: string | null = null;

        const convert = async (): Promise<void> => {
            try {
                const embedded = await imageDocumentForDisplay(src);

                if (cancelled) {
                    return;
                }

                if (embedded !== src) {
                    setDecoded({ source: src, url: embedded });

                    return;
                }

                const response = await fetch(src, { referrerPolicy: 'no-referrer' });

                if (!response.ok) {
                    return;
                }

                const blob = await response.blob();
                const image = await imageForDisplay(blob);

                if (cancelled || image === blob) {
                    return;
                }

                url = URL.createObjectURL(image);
                setDecoded({ source: src, url });
            } catch {
                // The failed image keeps the browser's alt text when it cannot be read or decoded.
            }
        };

        void convert();

        return () => {
            cancelled = true;

            if (url !== null) {
                URL.revokeObjectURL(url);
            }
        };
    }, [src, retry]);

    return (
        <img
            src={converted ?? src}
            {...props}
            onError={(event) => {
                if (typeof src === 'string' && retry !== src) {
                    setRetry(src);
                }

                onError?.(event);
            }}
        />
    );
}
