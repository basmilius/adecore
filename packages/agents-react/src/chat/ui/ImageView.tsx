import { createContext, useContext, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, ImageOff, Minus, Plus, RotateCcw } from 'lucide-react';
import type { ResourceUrl } from '../../host';
import { ButtonGroup, CloseButton, Dialog, Icon, IconButton, Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import { BUTTON_STEP, clamped, MAX_SCALE, MIN_SCALE, START, stepped, wheeled, zoomed, type Bounds, type Point, type View } from '../logic/lightbox';
import { DisplayImage } from './DisplayImage';

interface LightboxImage {
    readonly key: string;
    readonly src: string;
    readonly alt: string;
    readonly element: HTMLElement | null;
}

interface ImageGroupStore {
    set(image: LightboxImage): void;
    remove(key: string): void;
    subscribe(listener: () => void): () => void;
    snapshot(): readonly LightboxImage[];
}

/* The pictures of one group in the order they stand on the page, which is the order the arrows walk. */
function createImageGroupStore(): ImageGroupStore {
    const images = new Map<string, LightboxImage>();
    const listeners = new Set<() => void>();
    let snapshot: readonly LightboxImage[] = [];

    const changed = (): void => {
        snapshot = [...images.values()].sort((a, b) => {
            if (a.element === null || b.element === null) {
                return 0;
            }

            return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        for (const listener of listeners) {
            listener();
        }
    };

    return {
        set(image) {
            const current = images.get(image.key);

            if (current?.src === image.src && current.alt === image.alt && current.element === image.element) {
                return;
            }

            images.set(image.key, image);
            changed();
        },
        remove(key) {
            if (images.delete(key)) {
                changed();
            }
        },
        subscribe(listener) {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        snapshot: () => snapshot
    };
}

interface ImageGroupValue {
    readonly store: ImageGroupStore;
    open(key: string): void;
}

const ImageGroupContext = createContext<ImageGroupValue | null>(null);

/*
 * Thumbnails inside open one lightbox together, where the arrow keys walk from one to the next.
 * A thumbnail with actions of its own, or one its caller opens from a control, stays on its own.
 */
export function ImageGroup({ children }: { children: ReactNode }) {
    const [store] = useState(createImageGroupStore);
    const images = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
    // The key stays after closing, so the picture that fades out is the one that was open.
    const [shown, setShown] = useState<{ key: string | null; open: boolean }>({ key: null, open: false });
    const index = images.findIndex((image) => image.key === shown.key);

    return (
        <ImageGroupContext value={{ store, open: (key) => setShown({ key, open: true }) }}>
            {children}
            {index !== -1 && (
                <Lightbox
                    images={images}
                    index={index}
                    open={shown.open}
                    onOpenChange={(open) => setShown((current) => ({ ...current, open }))}
                    onIndexChange={(next) => setShown({ key: images[next]?.key ?? null, open: true })}
                />
            )}
        </ImageGroupContext>
    );
}

/* A press on an arrow or a zoom button is the button's, never the start of a pan or a zoom of the stage. */
function onControl(target: EventTarget): boolean {
    return target instanceof Element && target.closest('button') !== null;
}

/* Where the pointer sits against the middle of the stage, which is what the transform counts from. */
function pointIn(stage: HTMLElement, event: { clientX: number; clientY: number }): Point {
    const rect = stage.getBoundingClientRect();

    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
}

function boundsOf(stage: HTMLElement): Bounds {
    const picture = stage.querySelector('img');

    return {
        image: { width: picture?.offsetWidth ?? 0, height: picture?.offsetHeight ?? 0 },
        frame: { width: stage.clientWidth, height: stage.clientHeight }
    };
}

/* Pictures large and on their own: a pinch zooms, two fingers pan, the arrow keys walk the group, Escape closes. */
function Lightbox({
    images,
    index,
    open,
    onOpenChange,
    onIndexChange,
    actions
}: {
    images: readonly LightboxImage[];
    index: number;
    open: boolean;
    onOpenChange(open: boolean): void;
    onIndexChange?(index: number): void;
    actions?: ReactNode;
}) {
    const { t } = useTranslation('agent-chat');
    const [view, setView] = useState<View>(START);
    const [viewed, setViewed] = useState(index);
    const stageElementRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const movedRef = useRef(false);
    const image = images[index];
    const previous = stepped(index, images.length, -1);
    const next = stepped(index, images.length, 1);

    if (viewed !== index) {
        setViewed(index);
        setView(START);
    }

    if (!open && view !== START) {
        setView(START);
    }

    if (image === undefined) {
        return null;
    }

    // The alt of an image an agent read is its path; the caption shows the file and keeps the path on a tooltip.
    const name = image.alt.slice(image.alt.lastIndexOf('/') + 1);
    const title = <span className="min-w-0 truncate text-xs text-text">{name}</span>;

    // React listens to the wheel passively, and only an active listener keeps a pinch from zooming the whole page.
    const stageRef = (stage: HTMLDivElement | null) => {
        stageElementRef.current = stage;

        if (stage === null) {
            return;
        }

        const onWheel = (event: WheelEvent): void => {
            event.preventDefault();
            const point = pointIn(stage, event);
            const bounds = boundsOf(stage);
            setView((current) => wheeled(current, event, point, bounds));
        };

        stage.addEventListener('wheel', onWheel, { passive: false });

        return () => stage.removeEventListener('wheel', onWheel);
    };

    const zoomButton = (factor: number): void => {
        const stage = stageElementRef.current;

        if (stage !== null) {
            const bounds = boundsOf(stage);
            setView((current) => zoomed(current, factor, { x: 0, y: 0 }, bounds));
        }
    };

    const step = (to: number | null): void => {
        if (to !== null) {
            onIndexChange?.(to);
        }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
        }

        const to = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : null;

        if (to !== null) {
            event.preventDefault();
            step(to);
        }
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Popup backdropClassName="lightbox-backdrop" className="lightbox" onKeyDown={onKeyDown}>
                <Dialog.Title className="sr-only">{image.alt}</Dialog.Title>
                <div className="lightbox-bar flex h-12 shrink-0 items-center justify-end gap-2 pl-3">
                    <span className="tabular-nums text-xs text-text-faint">{formatNumber(view.scale * 100)}%</span>
                    <ButtonGroup render={<span />}>
                        <IconButton
                            icon={Minus}
                            size="sm"
                            label={t('image.zoomOut')}
                            disabled={view.scale <= MIN_SCALE}
                            onClick={() => zoomButton(1 / BUTTON_STEP)}
                        />
                        <IconButton
                            icon={Plus}
                            size="sm"
                            label={t('image.zoomIn')}
                            disabled={view.scale >= MAX_SCALE}
                            onClick={() => zoomButton(BUTTON_STEP)}
                        />
                        <IconButton icon={RotateCcw} size="sm" label={t('image.reset')} disabled={view.scale === MIN_SCALE} onClick={() => setView(START)} />
                    </ButtonGroup>
                    {actions}
                    <CloseButton label={t('common.action.close')} kbd="esc" className="ml-1" dialog />
                </div>
                <div
                    ref={stageRef}
                    className={clsx('lightbox-stage relative grid min-h-0 grow place-items-center overflow-hidden', view.scale > MIN_SCALE && 'cursor-grab')}
                    onDoubleClick={(e) => {
                        if (onControl(e.target)) {
                            return;
                        }

                        const point = pointIn(e.currentTarget, e);
                        const bounds = boundsOf(e.currentTarget);
                        setView((current) => (current.scale > MIN_SCALE ? START : zoomed(current, 2, point, bounds)));
                    }}
                    onPointerDown={(e) => {
                        movedRef.current = false;

                        if (view.scale <= MIN_SCALE || onControl(e.target)) {
                            return;
                        }

                        e.currentTarget.setPointerCapture(e.pointerId);
                        dragRef.current = { pointerId: e.pointerId, x: e.clientX - view.x, y: e.clientY - view.y };
                    }}
                    onPointerMove={(e) => {
                        const drag = dragRef.current;

                        if (drag?.pointerId !== e.pointerId) {
                            return;
                        }

                        movedRef.current = true;
                        const bounds = boundsOf(e.currentTarget);
                        setView((current) => clamped({ ...current, x: e.clientX - drag.x, y: e.clientY - drag.y }, bounds));
                    }}
                    onPointerUp={() => {
                        dragRef.current = null;
                    }}
                    onPointerCancel={() => {
                        dragRef.current = null;
                    }}
                    onClick={(e) => {
                        // The room around the picture is the backdrop a dialog would have, unless the press panned.
                        if (e.target === e.currentTarget && !movedRef.current) {
                            onOpenChange(false);
                        }
                    }}
                >
                    <DisplayImage
                        key={image.key}
                        src={image.src}
                        alt={image.alt}
                        draggable={false}
                        className="select-none"
                        style={{ transform: `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px) scale(${view.scale})` }}
                    />
                    {images.length > 1 && (
                        <>
                            <IconButton
                                icon={ChevronLeft}
                                label={t('image.previous')}
                                kbd="←"
                                disabled={previous === null}
                                className="absolute top-1/2 left-4 -translate-y-1/2"
                                onClick={() => step(previous)}
                            />
                            <IconButton
                                icon={ChevronRight}
                                label={t('image.next')}
                                kbd="→"
                                disabled={next === null}
                                className="absolute top-1/2 right-4 -translate-y-1/2"
                                onClick={() => step(next)}
                            />
                        </>
                    )}
                </div>
                <div className="flex h-12 shrink-0 items-center justify-center gap-3 px-3">
                    {name === image.alt ? title : <Tooltip label={image.alt}>{title}</Tooltip>}
                    {images.length > 1 && (
                        <span className="shrink-0 tabular-nums text-xs text-text-faint">
                            {t('image.position', { index: formatNumber(index + 1), count: formatNumber(images.length) })}
                        </span>
                    )}
                </div>
            </Dialog.Popup>
        </Dialog.Root>
    );
}

export interface ImageThumbProps {
    source: ResourceUrl;
    alt: string;
    className?: string;
    /* Width over height, known before the bytes: the thumbnail then fills its container's width at that ratio and holds its place while they load. */
    aspect?: number;
    /* Drawn in the lightbox's header before Close, such as icon buttons that act on the image. */
    actions?: ReactNode;
    /* Whether the lightbox is open, for a caller that opens it from a control of its own; left out, the thumbnail keeps it. */
    open?: boolean;
    onOpenChange?(open: boolean): void;
}

/*
 * A thumbnail that opens the same image large. The button is the picture, so there is nothing to aim at.
 * The image is bytes where the host keeps them; until they are here a quiet square stands in for it.
 */
export function ImageThumb({ source, alt, className, aspect, actions, open: openProp, onOpenChange }: ImageThumbProps) {
    const key = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const context = useContext(ImageGroupContext);
    const group = actions === undefined && openProp === undefined ? context : null;
    const [ownOpen, setOwnOpen] = useState(false);
    const open = openProp ?? ownOpen;
    const { url: src, failure } = source;
    const ratio = aspect === undefined ? undefined : { aspectRatio: aspect };

    useLayoutEffect(() => {
        if (group === null || src === null) {
            return;
        }

        group.store.set({ key, src, alt, element: buttonRef.current });

        return () => group.store.remove(key);
    }, [group, key, src, alt]);

    const setOpen = (next: boolean): void => {
        setOwnOpen(next);
        onOpenChange?.(next);
    };

    if (src === null) {
        return (
            <span
                className={clsx(
                    'grid place-items-center rounded-lg border border-border bg-surface-sunken text-text-faint',
                    aspect === undefined ? 'size-16' : 'w-full'
                )}
                style={ratio}
            >
                {failure !== null && (
                    <Tooltip label={failure}>
                        <Icon icon={ImageOff} size={14} />
                    </Tooltip>
                )}
            </span>
        );
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={clsx('block overflow-hidden rounded-lg border border-border', aspect !== undefined && 'w-full')}
                style={ratio}
                onClick={() => (group === null ? setOpen(true) : group.open(key))}
            >
                <DisplayImage src={src} alt={alt} className={clsx(aspect !== undefined && 'size-full object-contain', className)} />
            </button>
            {group === null && <Lightbox images={[{ key, src, alt, element: null }]} index={0} open={open} onOpenChange={setOpen} actions={actions} />}
        </>
    );
}
