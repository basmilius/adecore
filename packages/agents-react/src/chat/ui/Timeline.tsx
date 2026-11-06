import type { ChatBookmark } from '@adecore/agent-contracts';
import { ContextMenu, EmptyState, ErrorBoundary, Icon, ScrollArea, SectionLabel } from '@adecore/ui';
import { defaultRangeExtractor, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import {
    type CSSProperties,
    memo,
    type RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    type ReactNode
} from 'react';
import { useTranslation } from 'react-i18next';
import { useModelName } from '../../agents/model-name';
import { useChatHost, type TimelineFindOptions } from '../../host/host';
import { useHostContextSources, useHostHidesToolCalls, useHostThreadCards, useHostTimelineFind, useHostWelcome } from '../../host/host-hooks';
import { type TimelineRow } from '../../host/timeline-row';
import { useChatScope } from '../../scope';
import { useChatRow, useChats } from '../../state/chats';
import { providersOf } from '../../state/providers';
import { useForkedTurns } from '../forks';
import { bookmarkRows } from '../logic/bookmarks';
import { forkRefusal } from '../logic/fork';
import {
    SCRUBBER_MIN_TICKS,
    STRIP_INSET_PX,
    STRIP_WIDTH_PX,
    messagesInView,
    stepMessage,
    threadPaddingLeft,
    STRIP_CLEARANCE_PX,
    tickOfRow,
    ticksOf,
    ticksWithHits,
    EARLIER_ROW
} from '../logic/scrubber';
import { timedRowsOf, withTimedRows } from '../logic/thread-cards';
import { deriveTimelineRows, findSubagentBranch } from '../logic/timeline';
import {
    EMPTY_TARGET,
    readTimelineTarget,
    revealUiReplyBlock,
    uiReplyJump,
    withCurrentText,
    type TimelineTarget,
    type UiReplyTarget
} from '../logic/timeline-target';
import { useChatPreferences } from '../preferences';
import { readingMeasure, readingWidthStyle } from '../reading-width';
import { openFromMain, useSubagentTrail, type SubagentStep } from '../subagent-view';
import { useTimelineFlash } from '../timeline-flash';
import {
    registerItemJumper,
    registerMessageStepper,
    registerTimeline,
    registerTurnJumper,
    setTimelineAtEnd,
    wantsEarlier,
    type ItemJumpOptions,
    type ReadingAnchor,
    type TurnTarget
} from '../timeline-scroll';
import { BookmarkMarker } from './BookmarkMarker';
import { ChatEmptyScene } from './ChatEmptyScene';
import { FileLinkContext } from './file-links';
import { FindRevealContext } from './find-reveal';
import { MessageActions } from './MessageActions';
import { QuoteTakerContext, type QuoteTaker } from './quote-selection';
import { QuoteButton } from './QuoteButton';
import { UiReplyNavigationContext } from './reply-context';
import { ReplyHeader } from './rows/MessageRows';
import { FOLLOW_THRESHOLD_PX, replyHeader } from './rows/row-rhythm';
import { RowContainer } from './rows/RowContainer';
import { Row, type RowProps } from './rows/Rows';
import { Scrubber, type CardChat } from './Scrubber';
import { TimelineMenuPopup } from './TimelineMenu';
import { useToggleSet } from './useToggleSet';
import { VisualDialogs } from './VisualDialogs';
import { WelcomeGreeting } from './Welcome';

const ESTIMATED_ROW_PX = 56;
// A wheel that counts in lines rather than pixels moves this far per line.
const WHEEL_LINE_PX = 16;
// How long a jump waits for a thread that is still loading before it calls the item missing.
const JUMP_THREAD_WAIT_MS = 8000;

/* A jump puts its row at the top and stops following the end, so the reader stays where they landed. */
function showRowAtTop(virtualizer: Virtualizer<HTMLDivElement, Element>, followRef: RefObject<boolean>, index: number): void {
    followRef.current = false;
    virtualizer.scrollToIndex(index, { align: 'start' });
}

/* What of the composer's height covers the thread: all of it while it fits, none in a welcome or once it fills the frame. */
function coveredBy(composerHeight: number, frameHeight: number, welcome: boolean): number {
    return !welcome && composerHeight < frameHeight - FOLLOW_THRESHOLD_PX ? composerHeight : 0;
}

/* Whether a wheel over `target` moves a scroller between it and `boundary`, such as a long draft. */
function scrollsWithin(target: Element, boundary: Element, deltaX: number, deltaY: number): boolean {
    for (let element: Element | null = target; element !== null; element = element.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(element);
        const scrollsY = (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight;
        const scrollsX = (overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth;

        if (scrollsY && (deltaY < 0 ? element.scrollTop > 0 : deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight)) {
            return true;
        }

        if (scrollsX && (deltaX < 0 ? element.scrollLeft > 0 : deltaX > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth)) {
            return true;
        }

        if (element === boundary) {
            return false;
        }
    }

    return false;
}

/* A thread before its first message: which model answers, and what the lines into this node let it read. */
function EmptyThread({ chatId }: { chatId: string }) {
    const { renderEmptyThread } = useChatHost();
    const { t } = useTranslation('agent-chat');
    const info = useChatRow(chatId, (row) => row?.info ?? null);
    const model = useModelName(info?.provider, info?.selection.model ?? '');
    const sources = useHostContextSources(chatId);

    return (
        <div className="flex grow items-center justify-center">
            <div className="flex max-w-sm flex-col items-center gap-3 px-6 py-8 text-center">
                <EmptyState
                    scene={info ? <ChatEmptyScene provider={info.provider} /> : undefined}
                    title={info ? t('timeline.empty.ready', { model }) : undefined}
                    className="p-0"
                >
                    {info ? t('timeline.empty.task') : t('timeline.empty.ask')}
                </EmptyState>
                {renderEmptyThread?.(chatId)}
                {sources.length > 0 && (
                    <div className="flex max-w-full flex-col items-center gap-1">
                        <SectionLabel>{t('timeline.empty.canRead')}</SectionLabel>
                        <span className="max-w-full text-xs text-text-muted">{sources.map((source) => source.title).join(', ')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/*
 * A row of the thread behind the chapter line of its bookmark. A message, the only row that takes a
 * bookmark, gets its actions under it; every other row carries a bookmark only for a reply it folds.
 */
function MarkableRow({ row, chatId, bookmark, children }: { row: TimelineRow; chatId: string; bookmark: ChatBookmark | null; children: ReactNode }) {
    if (row.kind !== 'user' && row.kind !== 'assistant') {
        return (
            <>
                {bookmark !== null && <BookmarkMarker chatId={chatId} itemId={bookmark.itemId} bookmark={bookmark} />}
                {children}
            </>
        );
    }

    return (
        <>
            <BookmarkMarker chatId={chatId} itemId={row.id} bookmark={bookmark} />
            <div className="group/message">
                {children}
                <MessageActions chatId={chatId} row={row} />
            </div>
        </>
    );
}

interface ThreadRowProps extends Omit<RowProps, 'openConversation'> {
    previous: TimelineRow | null;
    index: number;
    top: number;
    measure: (element: HTMLDivElement | null) => void;
    /* The nonce of the flash on this row, or null when it has none. */
    flashNonce: number | null;
    bookmark: ChatBookmark | null;
    openConversation(step: SubagentStep): void;
}

/* Memoized with stable props, so a streamed word or a scroll draws only the rows it changed. */
const ThreadRow = memo(function ThreadRow({ row, previous, index, top, measure, chatId, flashNonce, bookmark, ...actions }: ThreadRowProps) {
    const header = replyHeader(row, previous);

    return (
        <RowContainer row={row} previous={previous} index={index} top={top} ref={measure}>
            {flashNonce !== null && <span key={flashNonce} className="chat-flash pointer-events-none absolute inset-0 rounded-lg" aria-hidden />}
            {header !== null && (
                <div className="chat-column-content w-full">
                    <ReplyHeader chatId={chatId} at={header.at} />
                </div>
            )}
            <MarkableRow row={row} chatId={chatId} bookmark={bookmark}>
                <Row row={row} chatId={chatId} {...actions} />
            </MarkableRow>
        </RowContainer>
    );
});

/*
 * `overlay` stands in the thread's place and ends where the composer starts, so the thread keeps
 * where it was underneath and the composer stays in reach for the prompts it answers.
 * `onContentHeight` hears what the thread's rows and its padding take, without the composer, once
 * the rows in view are laid out at their real heights, for a host that sizes its frame to the thread.
 * Rows out of view still count at an estimate, so a frame up to the viewport's height gets it exact.
 */
export function Timeline({
    chatId,
    composer,
    overlay,
    onContentHeight
}: {
    chatId: string;
    composer?: ReactNode;
    overlay?: ReactNode;
    onContentHeight?: (height: number) => void;
}) {
    const host = useChatHost();
    const { fork } = host;
    const { t } = useTranslation('agent-chat');
    const order = useChatRow(chatId, (row) => row?.order);
    // The structure, not the items. A delta growing a reply must not derive every row again.
    const items = useChatRow(chatId, (row) => row?.structure);
    const activeTurnId = useChatRow(chatId, (row) => row?.info.activeTurnId ?? null);
    const bookmarks = useChatRow(chatId, (row) => row?.bookmarks);
    const outlineBefore = useChatRow(chatId, (row) => row?.outlineBefore);
    const visuals = useChatRow(chatId, (row) => row?.visuals);
    const forkedTurns = useForkedTurns(chatId);
    const info = useChatRow(chatId, (row) => row?.info ?? null);
    const historyPending = useChatRow(chatId, (row) => row?.historyPending === true);
    const cursor = useChatRow(chatId, (row) => row?.history?.cursor ?? null);
    const scope = useChatScope();
    const { id: scopeId, keyOf } = scope;

    // Read when the menu opens rather than subscribed to, for the same reason the rows use the structure.
    const fullItems = () => useChats.getState().byKey[keyOf(chatId)]?.items;

    const scrollRef = useRef<HTMLDivElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const quoteTakerRef = useRef<QuoteTaker | null>(null);

    const registerQuoteTaker = useCallback((take: QuoteTaker) => {
        quoteTakerRef.current = take;

        return () => {
            if (quoteTakerRef.current === take) {
                quoteTakerRef.current = null;
            }
        };
    }, []);

    const followRef = useRef(true);

    const stopFollowing = useCallback(() => {
        followRef.current = false;
    }, []);

    const groups = useToggleSet(stopFollowing);
    const turns = useToggleSet(stopFollowing);
    const subagents = useToggleSet(stopFollowing);
    const scrollGeometry = useRef({ top: 0, height: 0, viewport: 0 });
    const [target, setTarget] = useState<TimelineTarget>(EMPTY_TARGET);
    const { trail, show } = useSubagentTrail(chatId);
    const frameRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);
    const spacerRef = useRef<HTMLDivElement>(null);
    const [composerHeight, setComposerHeight] = useState(0);
    const [frame, setFrame] = useState({ width: 0, height: 0, column: false });
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const loadingEarlierRef = useRef(false);
    const anchorRef = useRef<ReadingAnchor | null>(null);
    const headRef = useRef<string | undefined>(undefined);

    const loadEarlier = useCallback(() => {
        if (cursor === null || loadingEarlierRef.current) {
            return;
        }

        loadingEarlierRef.current = true;
        setLoadingEarlier(true);

        // A page that failed is asked for again on the next scroll; the thread keeps what it has.
        void scope.chats
            .loadEarlier(chatId, cursor)
            .catch(() => undefined)
            .finally(() => {
                loadingEarlierRef.current = false;
                setLoadingEarlier(false);
            });
    }, [scope, chatId, cursor]);

    const hideTools = useHostHidesToolCalls(scopeId, chatId);

    const threadRows = useMemo(() => {
        if (!order || !items) {
            return [];
        }

        return deriveTimelineRows(
            order.map((id) => items[id]!),
            {
                expandedGroups: groups.ids,
                expandedTurns: turns.ids,
                expandedSubagents: subagents.ids,
                activeTurnId,
                forkedTurns,
                commandLooks: host.commandLooks,
                toolLooks: host.toolLooks,
                hideTools
            }
        );
    }, [order, items, groups.ids, turns.ids, subagents.ids, activeTurnId, forkedTurns, host.commandLooks, host.toolLooks, hideTools]);

    const cards = useHostThreadCards(scopeId, chatId);
    const drawsVisuals = host.visuals !== null;
    // Where the part of the thread this client holds begins, while there is a page before it.
    const heldFrom = cursor === null ? null : (items?.[order?.[0] ?? '']?.createdAt ?? null);

    const rows = useMemo(
        () => withTimedRows(threadRows, timedRowsOf(cards, drawsVisuals ? (visuals ?? []) : null, heldFrom)),
        [threadRows, cards, drawsVisuals, visuals, heldFrom]
    );

    const welcomes = useHostWelcome(chatId);

    const loadingHistory = historyPending && ((info !== null && (info.usage.turns > 0 || info.activeTurnId !== null)) || (order?.length ?? 0) > 0);
    const empty = rows.length === 0;
    // A chat that took a turn before is one whose thread has not come in yet, not one to greet.
    const welcome = !loadingHistory && welcomes && empty && (info === null || (info.usage.turns === 0 && info.activeTurnId === null));
    const marks = useMemo(() => bookmarkRows(rows, bookmarks ?? [], items ?? {}), [rows, bookmarks, items]);
    const ticks = useMemo(() => ticksOf(rows, marks, outlineBefore, bookmarks), [rows, marks, outlineBefore, bookmarks]);
    // A message a jump is on its way to; it may first have to open the turn its reply folded into.
    const [seeking, setSeeking] = useState<{ itemId: string; block?: UiReplyTarget; key: string; options?: ItemJumpOptions } | null>(null);
    const [landing, setLanding] = useState<{ target: UiReplyTarget; key: string } | null>(null);
    // A turn a jump is on its way to, which waits for the page its messages are on to come in.
    const [revealing, setRevealing] = useState<{ turnId: string; target: TurnTarget } | null>(null);
    const flash = useTimelineFlash((s) => s.target);

    const revealBlock = useCallback(
        (block: UiReplyTarget) => {
            setLanding(null);
            setSeeking({ itemId: block.itemId, block, key: keyOf(chatId) });
        },
        [keyOf, chatId]
    );

    const uiNavigation = useMemo(
        () => ({
            chatId,
            reveal: revealBlock,
            flash: flash?.key === keyOf(chatId) && flash.block ? { itemId: flash.rowId, ...flash.block, nonce: flash.nonce } : null
        }),
        [revealBlock, flash, keyOf, chatId]
    );

    // Whether the thread's text clears the strip depends on the width of the view, which only the thread's own frame tells.
    useLayoutEffect(() => {
        const element = frameRef.current;

        if (element === null || typeof ResizeObserver === 'undefined') {
            return;
        }

        const column = element.closest('.chat-column') !== null;

        const measure = (): void =>
            setFrame((current) =>
                current.width === element.offsetWidth && current.height === element.offsetHeight && current.column === column
                    ? current
                    : { width: element.offsetWidth, height: element.offsetHeight, column }
            );

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        measure();

        return () => observer.disconnect();
    }, []);

    const coverRef = useRef({ frameHeight: frame.height, welcome });
    coverRef.current = { frameHeight: frame.height, welcome };

    useLayoutEffect(() => {
        const element = composerRef.current;

        if (element === null) {
            return;
        }

        // The composer lies outside the scroller, so the space under the thread follows its height here,
        // before the page paints, and the end with it; the state is drawn only after that paint.
        const measure = () => {
            const height = element.offsetHeight;
            const spacer = spacerRef.current;
            const scroller = scrollRef.current;

            if (spacer !== null && scroller !== null) {
                spacer.style.height = `${coveredBy(height, coverRef.current.frameHeight, coverRef.current.welcome)}px`;

                if (followRef.current) {
                    scroller.scrollTop = scroller.scrollHeight;
                    scrollGeometry.current = { top: scroller.scrollTop, height: scroller.scrollHeight, viewport: scroller.clientHeight };
                }
            }

            setComposerHeight(height);
        };

        const observer = new ResizeObserver(measure);
        observer.observe(element);
        measure();

        return () => observer.disconnect();
    }, []);

    // A composer that would leave too little of the thread covers the frame and scrolls by itself.
    const coveredHeight = coveredBy(composerHeight, frame.height, welcome);
    const fillsFrame = !welcome && coveredHeight === 0 && composerHeight > 0;
    const coveredHeightRef = useRef(coveredHeight);
    coveredHeightRef.current = coveredHeight;

    // The composer pages through the thread with PageUp and PageDown; this is the element it moves.
    useEffect(
        () =>
            registerTimeline(
                chatId,
                scrollRef.current,
                (enabled) => {
                    followRef.current = enabled;
                },
                () => coveredHeightRef.current
            ),
        [chatId]
    );

    const [measuredThread, setMeasuredThread] = useState<string | null>(null);
    const initialLayout = measuredThread !== keyOf(chatId);
    const [, settleLayout] = useReducer((count: number) => count + 1, 0);

    // Changing this callback invalidates every cached measurement, including on a scroll.
    const getItemKey = useCallback((index: number) => rows[index]!.id, [rows]);

    // Follow the browser's actual end below. Virtual end anchoring drifts when growth still fits without scrolling.
    // oxlint-disable-next-line react/incompatible-library
    const virtualizer = useVirtualizer({
        count: loadingHistory ? 0 : rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ESTIMATED_ROW_PX,
        getItemKey,
        overscan: 8,
        // Include the end before the first pin, so its actual heights are known before revealing it.
        rangeExtractor: (range) => {
            const indexes = defaultRangeExtractor(range);

            if (!initialLayout) {
                return indexes;
            }

            const tail = Math.max(8, Math.ceil(frame.height / ESTIMATED_ROW_PX));

            return [...new Set([...indexes, ...Array.from({ length: Math.min(tail, range.count) }, (_, index) => range.count - 1 - index)])].sort(
                (left, right) => left - right
            );
        },
        measureElement: (element, entry) => Math.round(entry?.borderBoxSize?.[0]?.blockSize ?? (element as HTMLElement).offsetHeight),
        scrollPaddingEnd: coveredHeight
    });

    /*
     * Rows are measured as they render, so the end moves while it is drawn (a streamed line, a diff that
     * highlights, an image that loads). `scrollToIndex` aims at where a row was when asked and fell
     * short; the scroller's own bottom is a fact, and a new total size says a row was measured again.
     * A word that does not add a line moves nothing, so the thread does not listen to the words.
     */
    const totalSize = virtualizer.getTotalSize();
    const virtualRows = virtualizer.getVirtualItems();

    useLayoutEffect(() => {
        if (!initialLayout || empty || loadingHistory || frame.height === 0) {
            return;
        }

        // Ref measurements can change offsets after render. Commit those offsets before the first paint.
        const measured = virtualizer.getVirtualItems();

        if (
            virtualRows.length !== measured.length ||
            virtualRows.some((row, index) => row.key !== measured[index]?.key || row.start !== measured[index]?.start || row.size !== measured[index]?.size)
        ) {
            settleLayout();

            return;
        }

        if (measured.at(-1)?.index === rows.length - 1) {
            setMeasuredThread(keyOf(chatId));
        }
    }, [initialLayout, empty, loadingHistory, frame.height, virtualRows, virtualizer, rows.length, keyOf, chatId]);

    useLayoutEffect(() => {
        const thread = threadRef.current;

        if (onContentHeight === undefined || initialLayout || empty || loadingHistory || thread === null) {
            return;
        }

        const style = getComputedStyle(thread);
        onContentHeight(totalSize + (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0));
    }, [onContentHeight, initialLayout, empty, loadingHistory, totalSize]);

    useLayoutEffect(() => {
        const element = scrollRef.current;

        if (!followRef.current || element === null) {
            return;
        }

        // The space under the thread is the composer's height, so that height is part of this end position.
        element.scrollTop = element.scrollHeight;
        scrollGeometry.current = { top: element.scrollTop, height: element.scrollHeight, viewport: element.clientHeight };
    }, [rows.length, totalSize, composerHeight, frame.height]);

    /*
     * A row measured again after the first paint is seen by an observer before the page paints, but the
     * state it sets is drawn after that paint. The end is pinned here as well, so the page never paints
     * the thread with its end out of view.
     */
    useLayoutEffect(() => {
        const content = contentRef.current;

        if (content === null || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(() => {
            const element = scrollRef.current;

            if (!followRef.current || element === null) {
                return;
            }

            element.scrollTop = element.scrollHeight;
            scrollGeometry.current = { top: element.scrollTop, height: element.scrollHeight, viewport: element.clientHeight };
        });

        observer.observe(content);

        return () => observer.disconnect();
    }, []);

    // Prepending history moves rows; keep the reader on the same row at the same height.
    useLayoutEffect(() => {
        const element = scrollRef.current;
        const head = order?.[0];
        const moved = head !== headRef.current;
        headRef.current = head;

        if (element === null) {
            return;
        }

        const anchor = anchorRef.current;
        const index = moved && anchor !== null && !followRef.current ? rows.findIndex((row) => row.id === anchor.id) : -1;

        if (anchor !== null && index !== -1) {
            virtualizer.getTotalSize();
            element.scrollTop = virtualizer.measurementsCache[index]!.start - anchor.offset;

            return;
        }

        const row = virtualizer.getVirtualItemForOffset(element.scrollTop);
        anchorRef.current = row === undefined ? null : { id: String(row.key), offset: row.start - element.scrollTop };
    });

    // Close to the top, the page before goes in; again after each page that left too little above the reader.
    useEffect(() => {
        const element = scrollRef.current;

        if (element !== null && wantsEarlier(element)) {
            loadEarlier();
        }
    }, [rows, loadEarlier, frame.height]);

    // A sub-agent in the thread's place hides the thread, and the strip and the keyboard go with it.
    const onMainAgent = trail.length === 0;
    // A node on a canvas has no strip. It is too narrow to give up a column of its width.
    const showsScrubber = frame.column && onMainAgent && ticks.length >= SCRUBBER_MIN_TICKS;
    const readingWidth = useChatPreferences((preferences) => preferences.readingWidth);
    const paddingLeft = threadPaddingLeft(frame.width, showsScrubber, readingMeasure(readingWidth));

    // The virtualizer materializes measurements on access; binary searches need only a few message starts.
    const measurements = virtualizer.measurementsCache;

    const starts = {
        length: ticks.length,
        at: (index: number): number | undefined => {
            const tick = ticks.at(index);

            return tick === undefined ? undefined : (measurements[tick.rowIndex]?.start ?? tick.rowIndex * ESTIMATED_ROW_PX);
        }
    };

    const scrollTop = virtualizer.scrollOffset ?? 0;
    const viewport = virtualizer.scrollRect?.height ?? 0;
    const visibleHeight = Math.max(0, viewport - coveredHeight);
    const visibleHeightRef = useRef(visibleHeight);
    visibleHeightRef.current = visibleHeight;
    const inView = showsScrubber ? messagesInView({ starts, scrollTop, visibleHeight }) : null;
    /*
     * The virtualizer draws again only when its range of rows changes, which a scroll inside one long
     * row never does; the scroll itself redraws the strip once the messages in view are others.
     */
    const [, redrawStrip] = useReducer((count: number) => count + 1, 0);
    const stripRef = useRef({ starts, inView });
    stripRef.current = { starts, inView };

    const followStrip = (element: HTMLElement): void => {
        const { starts: current, inView: shown } = stripRef.current;

        if (shown === null) {
            return;
        }

        const next = messagesInView({ starts: current, scrollTop: element.scrollTop, visibleHeight: visibleHeightRef.current });

        if (next?.first !== shown.first || next?.last !== shown.last) {
            redrawStrip();
        }
    };

    // One object while what it holds stays, so a find that keys an effect on it does not run it for every scroll.
    const findOptions = useMemo<TimelineFindOptions>(
        () => ({
            chatId,
            frame: frameRef,
            thread: threadRef,
            scroller: scrollRef,
            enabled: onMainAgent,
            rows,
            structure: items,
            order,
            firstRowInView: () => {
                const top = scrollRef.current?.scrollTop ?? 0;

                return virtualizer.getVirtualItems().find((virtualRow) => virtualRow.end > top)?.index ?? 0;
            },
            openTurn: turns.add,
            openGroup: groups.add,
            openSubagent: subagents.add,
            // A row already on screen stays put; the find scrolls to the match itself once it is drawn.
            scrollToRow: (index) => {
                const top = scrollRef.current?.scrollTop ?? 0;
                const bottom = top + visibleHeightRef.current;

                if (!virtualizer.getVirtualItems().some((virtualRow) => virtualRow.index === index && virtualRow.end > top && virtualRow.start < bottom)) {
                    virtualizer.scrollToIndex(index, { align: 'center' });
                }
            },
            coveredHeight: () => coveredHeightRef.current,
            stopFollowing
        }),
        [chatId, onMainAgent, rows, items, order, virtualizer, turns.add, groups.add, subagents.add, stopFollowing]
    );

    const chatFind = useHostTimelineFind(findOptions);
    const searching = chatFind.open;

    // A find covers the whole thread, so every page before this one comes in while it is open.
    useEffect(() => {
        if (searching) {
            loadEarlier();
        }
    }, [searching, loadEarlier]);

    const found = useMemo(() => (searching ? ticksWithHits(ticks, chatFind.hitRows) : []), [searching, ticks, chatFind.hitRows]);
    const foundCurrent = chatFind.currentRow === null ? null : tickOfRow(ticks, chatFind.currentRow);

    const jumpTo = (index: number): void => {
        const tick = ticks[index];

        if (!tick) {
            return;
        }

        // A message before the rows this client holds comes in page by page until its row is there.
        if (tick.bookmark !== null || tick.rowIndex === EARLIER_ROW) {
            setLanding(null);
            setSeeking({ itemId: tick.bookmark?.itemId ?? tick.id, key: keyOf(chatId) });

            return;
        }

        showRowAtTop(virtualizer, followRef, tick.rowIndex);
    };

    useLayoutEffect(() => {
        if (seeking === null) {
            return;
        }

        if (seeking.key !== keyOf(chatId)) {
            setSeeking(null);

            return;
        }

        if (loadingHistory) {
            return;
        }

        if (seeking.block) {
            const jump = uiReplyJump(seeking.block, rows, items, turns.ids, cursor !== null);

            if (jump.kind === 'earlier') {
                loadEarlier();
            } else if (jump.kind === 'turn') {
                turns.add(jump.turnId);
            } else {
                setSeeking(null);

                if (jump.kind === 'row') {
                    showRowAtTop(virtualizer, followRef, jump.index);
                    setLanding({ target: seeking.block, key: seeking.key });
                }
            }

            return;
        }

        const index = rows.findIndex((row) => row.id === seeking.itemId);

        if (index !== -1) {
            setSeeking(null);
            showRowAtTop(virtualizer, followRef, index);

            if (seeking.options?.flash) {
                useTimelineFlash.getState().flash(seeking.key, seeking.itemId, false);
            }

            return;
        }

        // The thread has not loaded yet, so nothing says the item is missing; the effect below bounds the wait.
        if (items === undefined) {
            return;
        }

        const item = items[seeking.itemId];

        if (item === undefined && cursor !== null) {
            loadEarlier();

            return;
        }

        const turnId = item?.turnId ?? null;

        if (turnId !== null && !turns.ids.has(turnId)) {
            turns.add(turnId);

            return;
        }

        setSeeking(null);
        seeking.options?.onMissing?.();
    }, [seeking, rows, items, turns, virtualizer, cursor, loadEarlier, keyOf, chatId, loadingHistory]);

    const waitingForThread = seeking !== null && (items === undefined || loadingHistory);

    useEffect(() => {
        if (!waitingForThread) {
            return;
        }

        const timer = window.setTimeout(() => {
            setSeeking(null);
            seeking?.options?.onMissing?.();
        }, JUMP_THREAD_WAIT_MS);

        return () => window.clearTimeout(timer);
    }, [waitingForThread, seeking]);

    useEffect(
        () =>
            registerItemJumper(keyOf(chatId), (itemId, options) => {
                setLanding(null);
                setSeeking({ itemId, key: keyOf(chatId), options });
            }),
        [keyOf, chatId]
    );

    useLayoutEffect(() => {
        if (!landing || landing.key !== keyOf(chatId)) {
            return;
        }

        let frame = 0;
        let attempts = 0;

        const reveal = () => {
            const scroller = scrollRef.current;

            if (scroller && revealUiReplyBlock(scroller, landing.target)) {
                useTimelineFlash.getState().flash(keyOf(chatId), landing.target.itemId, false, landing.target);
                setLanding(null);
            } else if (++attempts < 30) {
                // Virtual rows mount after scrollToIndex updates the visible range.
                frame = requestAnimationFrame(reveal);
            } else {
                setLanding(null);
            }
        };

        frame = requestAnimationFrame(reveal);

        return () => cancelAnimationFrame(frame);
    }, [landing, keyOf, chatId]);

    useLayoutEffect(() => {
        if (revealing === null) {
            return;
        }

        const { turnId, target } = revealing;
        const changes = target === 'changes' ? rows.findIndex((row) => row.kind === 'changed-files' && row.turnId === turnId) : -1;
        const opening = order?.map((id) => items?.[id]).find((item) => item?.kind === 'user' && item.turnId === turnId);
        const found = changes !== -1 ? changes : rows.findIndex((row) => row.id === opening?.id || row.id === `start-${turnId}` || row.id === `fold-${turnId}`);

        if (found !== -1) {
            setRevealing(null);
            showRowAtTop(virtualizer, followRef, found);
            useTimelineFlash.getState().flash(keyOf(chatId), rows[found]!.id, changes !== -1);

            return;
        }

        // The turn is before the page this thread holds; a thread that holds it all has no such turn.
        if (cursor === null) {
            setRevealing(null);

            return;
        }

        loadEarlier();
    }, [revealing, rows, order, items, virtualizer, cursor, loadEarlier, keyOf, chatId]);

    useEffect(() => registerTurnJumper(keyOf(chatId), (turnId, target) => setRevealing({ turnId, target })), [keyOf, chatId]);
    // The strip is memoized and draws on every scroll, so it gets one callback for its life.
    const jumpRef = useRef(jumpTo);
    jumpRef.current = jumpTo;
    const pick = useCallback((index: number) => jumpRef.current(index), []);

    // Read when the card asks rather than on every render, so the strip's memo holds while the thread streams.
    const cardChat = useMemo<CardChat>(
        () => ({
            chatId,
            canFork: (turnId) => {
                if (fork === null) {
                    return false;
                }

                const row = useChats.getState().byKey[keyOf(chatId)];

                return forkRefusal(row?.info ?? null, row?.structure[turnId], providersOf(scopeId)) === null;
            },
            fork: (turnId) => fork?.(chatId, turnId)
        }),
        [keyOf, scopeId, chatId, fork]
    );

    const stepRef = useRef<(direction: -1 | 1) => boolean>(() => false);

    stepRef.current = (direction) => {
        if (!onMainAgent) {
            return false;
        }

        const index = stepMessage(starts, (i) => ticks[i]!.kind === 'person', scrollTop, direction);

        if (index === null) {
            return false;
        }

        jumpTo(index);

        return true;
    };

    useEffect(() => registerMessageStepper(keyOf(chatId), (direction) => stepRef.current(direction)), [keyOf, chatId]);

    // Read through a ref, so the rows keep one callback for their life and their memo holds.
    const opensRef = useRef({ rows, show });
    opensRef.current = { rows, show };

    /* The whole of what a sub-agent did, in the thread's place. Its row only keeps the beginning. */
    const openConversation = useCallback((step: SubagentStep): void => {
        opensRef.current.show(openFromMain(step));
    }, []);

    const addSubagent = subagents.add;

    /* The header of a turn a sub-agent woke. It points at the row that agent worked in, or the one it hangs under. */
    const openSubagent = useCallback(
        (toolUseId: string): void => {
            const found = findSubagentBranch(opensRef.current.rows, toolUseId);

            if (!found) {
                return;
            }

            addSubagent(found.branch.id);
            showRowAtTop(virtualizer, followRef, found.index);
        },
        [addSubagent, virtualizer]
    );

    const flashedRow = flash !== null && flash.key === keyOf(chatId) && !flash.block ? flash.rowId : null;

    return (
        // A file an answer names is relative to the folder this chat runs in, which is a worktree as
        // often as it is the project itself.
        <FileLinkContext.Provider value={info?.cwd ?? null}>
            <div
                ref={frameRef}
                className="relative flex min-h-0 grow flex-col"
                style={readingWidthStyle(readingWidth)}
                data-file-cwd={info?.cwd ?? ''}
                data-file-scope-id={scope.id}
            >
                {searching && chatFind.bar}
                {/* A welcome centers the greeting and the composer as one group. The composer keeps its
                    place in the tree, so the first message does not mount it again. */}
                <div className={clsx('relative flex min-h-0 grow flex-col', welcome && 'justify-center')}>
                    <ContextMenu.Root>
                        <ScrollArea
                            // Only down: wide content such as code and diffs scrolls in its own box, so a thread never moves sideways.
                            axis="y"
                            viewportRef={scrollRef}
                            className={clsx(!welcome && 'grow')}
                            viewportClassName="chat-scroll"
                            coveredBottom={coveredHeight}
                            // The thread keeps its reader in place itself when a page goes in above.
                            style={{ overflowAnchor: 'none' }}
                            onScrollCapture={(e) => {
                                const el = e.currentTarget;
                                // Capture the reader's movement before virtualization remeasures rows and shifts the scroll offset.
                                const previous = scrollGeometry.current;
                                const layoutChanged = previous.height !== el.scrollHeight || previous.viewport !== el.clientHeight;
                                const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;

                                if (!layoutChanged && el.scrollTop < previous.top) {
                                    followRef.current = false;
                                } else if (atEnd) {
                                    followRef.current = true;
                                }

                                scrollGeometry.current = { top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight };
                                setTimelineAtEnd(chatId, followRef.current);

                                if (wantsEarlier(el)) {
                                    loadEarlier();
                                }

                                followStrip(el);
                            }}
                        >
                            <div ref={contentRef} className="relative flex min-h-full flex-col">
                                <ContextMenu.Trigger
                                    ref={threadRef}
                                    className={clsx('chat-thread flex flex-col px-4 pt-4', !welcome && 'grow')}
                                    style={
                                        {
                                            paddingLeft,
                                            '--chat-wide-inset': `${2 * (showsScrubber ? STRIP_CLEARANCE_PX : paddingLeft) - paddingLeft}px`
                                        } as CSSProperties
                                    }
                                    inert={overlay ? true : undefined}
                                    onContextMenu={(e) =>
                                        setTarget(readTimelineTarget(e.target as HTMLElement, threadRef.current, withCurrentText(rows, fullItems())))
                                    }
                                >
                                    {loadingHistory ? (
                                        <div className="flex grow items-center justify-center gap-2 text-sm text-text-muted" role="status">
                                            <Icon icon={LoaderCircle} size={16} className="animate-spin" />
                                            <span>{t('timeline.loading')}</span>
                                        </div>
                                    ) : welcome ? (
                                        <WelcomeGreeting chatId={chatId} />
                                    ) : empty ? (
                                        <EmptyThread chatId={chatId} />
                                    ) : (
                                        <div
                                            className="relative w-full shrink-0"
                                            style={{ height: totalSize, visibility: initialLayout ? 'hidden' : undefined }}
                                        >
                                            <UiReplyNavigationContext.Provider value={uiNavigation}>
                                                <FindRevealContext.Provider value={chatFind.reveal}>
                                                    {virtualRows.map((virtualRow) => {
                                                        const row = rows[virtualRow.index]!;

                                                        return (
                                                            <ThreadRow
                                                                key={row.id}
                                                                row={row}
                                                                previous={virtualRow.index > 0 ? rows[virtualRow.index - 1]! : null}
                                                                index={virtualRow.index}
                                                                top={virtualRow.start}
                                                                measure={virtualizer.measureElement}
                                                                chatId={chatId}
                                                                flashNonce={flash !== null && flashedRow === row.id ? flash.nonce : null}
                                                                bookmark={marks.get(row.id) ?? null}
                                                                toggleGroup={groups.toggle}
                                                                toggleTurn={turns.toggle}
                                                                toggleSubagent={subagents.toggle}
                                                                openSubagent={openSubagent}
                                                                openConversation={openConversation}
                                                            />
                                                        );
                                                    })}
                                                </FindRevealContext.Provider>
                                            </UiReplyNavigationContext.Provider>
                                        </div>
                                    )}
                                </ContextMenu.Trigger>
                                <QuoteButton thread={threadRef} frame={contentRef} taker={quoteTakerRef} />
                                <div ref={spacerRef} className="shrink-0" style={{ height: coveredHeight }} aria-hidden />
                            </div>
                        </ScrollArea>
                        <TimelineMenuPopup target={target} thread={threadRef} chatId={onMainAgent ? chatId : null} column={frame.column} />
                    </ContextMenu.Root>
                    {/*
                     * Over the thread rather than in its scroller, so the thread bounces at its end and the
                     * composer stays put. It lies above a sub-agent's overlay, which leaves the composer's height free for it.
                     */}
                    <div
                        className="z-10 shrink-0"
                        style={
                            welcome
                                ? { position: 'relative' }
                                : fillsFrame
                                  ? { position: 'absolute', inset: 0, overflowY: 'auto' }
                                  : { position: 'absolute', insetInline: 0, bottom: 0 }
                        }
                        onWheel={(e) => {
                            const scroller = scrollRef.current;

                            // A wheel over the composer moves the thread it lies over, as it did inside the scroller.
                            if (
                                scroller === null ||
                                coveredHeight === 0 ||
                                e.ctrlKey ||
                                scrollsWithin(e.target as Element, e.currentTarget, e.deltaX, e.deltaY)
                            ) {
                                return;
                            }

                            const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? scroller.clientHeight : 1;
                            scroller.scrollTop += e.deltaY * unit;
                            scroller.scrollLeft += e.deltaX * unit;
                        }}
                    >
                        <div
                            ref={composerRef}
                            // The card is translucent so the thread shows through it, but the pb-3 strip under it must stay opaque.
                            className={clsx(
                                composer && 'px-3 pb-3 pt-3 bg-[linear-gradient(to_bottom,transparent_calc(100%-12px),var(--surface)_calc(100%-12px))]'
                            )}
                        >
                            <QuoteTakerContext.Provider value={registerQuoteTaker}>{composer}</QuoteTakerContext.Provider>
                        </div>
                    </div>
                </div>
                {drawsVisuals && <VisualDialogs chatId={chatId} />}
                {loadingEarlier && !overlay && (
                    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center" role="status">
                        <Icon icon={LoaderCircle} size={16} className="animate-spin text-text-faint" />
                        <span className="sr-only">{t('timeline.loadingEarlier')}</span>
                    </div>
                )}
                {showsScrubber && !overlay && (
                    <div className="absolute top-4" style={{ left: STRIP_INSET_PX, width: STRIP_WIDTH_PX, bottom: coveredHeight }}>
                        <ErrorBoundary label={t('timeline.stripFailed')} resetKeys={[ticks.length]}>
                            <Scrubber
                                ticks={ticks}
                                firstInView={inView?.first ?? null}
                                lastInView={inView?.last ?? null}
                                onPick={pick}
                                chat={cardChat}
                                found={found}
                                foundCurrent={foundCurrent}
                            />
                        </ErrorBoundary>
                    </div>
                )}
                {overlay && (
                    <div className="absolute inset-0 z-5 flex flex-col bg-surface" style={{ paddingBottom: coveredHeight }}>
                        {overlay}
                    </div>
                )}
            </div>
        </FileLinkContext.Provider>
    );
}
