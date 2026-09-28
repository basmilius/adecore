import { useState } from 'react';
import { SegmentBar, Waveform } from '@basmilius/react-ui';

const DURATION = 225;

const SECTIONS = [
    { name: 'Intro', length: 22 },
    { name: 'Verse', length: 58 },
    { name: 'Chorus', length: 64 },
    { name: 'Bridge', length: 36 },
    { name: 'Outro', length: 45 }
];

const STARTS = SECTIONS.map((_, i) => SECTIONS.slice(0, i).reduce((sum, section) => sum + section.length, 0));

// One sample per 100 ms, as a loudness analysis gives them.
const LEVELS = Array.from({ length: DURATION * 10 }, (_, i) => {
    const swell = 0.55 + 0.35 * Math.sin((i / (DURATION * 10)) * Math.PI * 3);
    const grain = 0.3 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.9));
    return Math.min(1, swell * 0.75 + grain);
});

export default function WaveformDemo() {
    const [time, setTime] = useState(83);
    const [scrubbing, setScrubbing] = useState(false);
    const at = STARTS.findLastIndex((start) => start <= time);

    return (
        <div className="flex w-full max-w-xl flex-col gap-2">
            <SegmentBar
                label="Sections"
                parts={SECTIONS.map((section, i) => ({ value: section.length, label: section.name, current: i === at }))}
                onSelect={(index) => setTime(STARTS[index] ?? 0)}
            />
            <Waveform
                label="Record"
                levels={LEVELS}
                duration={DURATION}
                value={time}
                onValueChange={(next) => {
                    setScrubbing(true);
                    setTime(next);
                }}
                onValueCommitted={() => setScrubbing(false)}
                marks={STARTS.slice(1)}
                className="h-32"
            />
            <span className="text-xs text-text-faint">{scrubbing ? 'Scrubbing' : 'Playing'}</span>
            <span className="mt-4 text-xs text-text-muted">Zoomed in on the chorus</span>
            <Waveform label="Score" levels={LEVELS} duration={DURATION} range={[70, 150]} value={time} marks={STARTS.slice(1)} className="h-8" />
        </div>
    );
}
