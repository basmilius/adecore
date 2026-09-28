import { useState } from 'react';
import { SegmentBar } from '@basmilius/react-ui';

const SECTIONS = [
    { value: 12, label: 'Intro' },
    { value: 36, label: 'Verse' },
    { value: 28, label: 'Chorus' },
    { value: 4, label: 'Break' },
    { value: 30, label: 'Outro' }
];

const SCENES = [
    { start: 8, value: 30, label: 'Interview' },
    { start: 46, value: 22, label: 'B-roll' },
    { start: 80, value: 24, label: 'Credits' }
];

const BEATS = [
    ...Array.from({ length: 5 }, () => ({ value: 1, color: 'var(--positive)' })),
    { value: 1, current: true },
    ...Array.from({ length: 4 }, () => ({ value: 1 }))
];

const CONTEXT = [
    { value: 18, label: 'System', color: 'var(--text-faint)' },
    { value: 34, label: 'Files read', color: 'var(--status-running)' },
    { value: 21, label: 'Conversation', color: 'var(--positive)' }
];

export default function SegmentBarDemo() {
    const [picked, setPicked] = useState(1);

    return (
        <div className="flex w-full max-w-xl flex-col gap-6">
            <SegmentBar label="Sections" parts={SECTIONS.map((part, i) => ({ ...part, current: i === picked }))} onSelect={setPicked} />
            <SegmentBar label="Sections" parts={SECTIONS.slice(0, 3)} range={[0, 110]} />
            <SegmentBar label="Scenes" parts={SCENES} range={[0, 110]} />
            <SegmentBar label="Beats" parts={BEATS} size="sm" />
            <SegmentBar label="Context" parts={CONTEXT} range={[0, 128]} size="sm" />
        </div>
    );
}
