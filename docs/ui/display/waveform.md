# Waveform

The loudness of a piece of audio over time. It colors what has played up to the playhead, and a press or a drag anywhere on it seeks there.

```tsx
import { Waveform } from '@adecore/ui';
```

<Demo src="display/waveform" />

`levels` holds loudness samples from 0 (silence) to 1, spread evenly over `duration`, at any rate. The waveform fits them to its width.

It fills the height `className` gives it, so it works as a player and as a timeline row.

```tsx
<Waveform label="Record" levels={levels} duration={225} value={time} onValueChange={seek} className="h-32" />
```

## A part of the audio

`range` shows only a stretch of the audio, such as the visible part of a zoomable timeline. Bars, marks, playhead and seeking all follow it. A [`SegmentBar`](/ui/display/segment-bar) takes the same `range`.

```tsx
<Waveform label="Score" levels={levels} duration={225} range={[70, 150]} className="h-8" />
```

## Seeking

With `onValueChange` the waveform is a slider. It takes focus, and a press or drag calls `onValueChange` with the time under the pointer. `onValueCommitted` follows when the drag ends.

| Key | Moves the playhead |
| --- | --- |
| Arrow keys | `step` seconds |
| Page Up, Page Down | Ten steps |
| Home, End | To either end |

Each key commits at once and stops there, so a transport higher up does not move the playhead twice. A screen reader hears the position as "01:23 of 03:45".

`onKeyDown` hears every key first. The waveform leaves a key you call `preventDefault` on alone and lets it bubble, so a player can bind Up and Down to something else:

```tsx
<Waveform
    label="Record"
    levels={levels}
    duration={225}
    value={time}
    onValueChange={seek}
    onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }
    }}
/>
```

Without `onValueChange` it is an image named by its `label`. Without `value` it draws no playhead.

`marks` draws a line through the waveform at each time, such as a cut.

## Props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `levels` | `readonly number[]` | | Required. Loudness samples from 0 to 1, spread evenly over `duration`. |
| `duration` | `number` | | Required. In seconds. |
| `label` | `string` | | Required. The name a screen reader reads. |
| `range` | `readonly [from: number, to: number]` | `[0, duration]` | The stretch it shows, in seconds. |
| `value` | `number` | | How far it has played, in seconds. Left out, it draws no playhead. |
| `onValueChange` | `(value: number) => void` | | Seeks to a time in seconds. Left out, the waveform only shows. |
| `onValueCommitted` | `(value: number) => void` | | The time a drag lets go at, or a key moved to. |
| `step` | `number` | `1` | How far an arrow key moves the playhead, in seconds. |
| `onKeyDown` | `(e: KeyboardEvent<HTMLDivElement>) => void` | | Hears a key first; after `preventDefault` the waveform lets it bubble. |
| `marks` | `readonly number[]` | `[]` | Times in seconds drawn as lines. |
| `className` | `string` | | Its height, which it fills. |
| `ref` | `Ref<HTMLDivElement>` | | |

`WaveformProps` is an exported type.
