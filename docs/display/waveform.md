# Waveform

The loudness of a piece of audio over time. It colors what has played up to the playhead, and a press or a drag anywhere on it seeks there.

```tsx
import { Waveform } from '@basmilius/desktop-ui';
```

<Demo src="display/waveform" />

`levels` holds the loudness as samples spread evenly over `duration`, from 0 for silence to 1 for the loudest, at whatever rate the analysis gives them. The waveform measures its own width and draws one bar per 3 pixels, each as loud as the loudest sample under it, so a long track at a fine rate stays sharp at any size. Silence still draws as a line.

It has no height of its own and fills the one `className` gives it, so the same waveform works as a player and as a row in a timeline.

```tsx
<Waveform label="Record" levels={levels} duration={225} value={time} onValueChange={seek} className="h-32" />
```

## A part of the audio

`range` shows only a stretch of the audio, such as the visible part of a timeline that zooms and scrolls. The bars, the marks, the playhead and a press all follow it, so the waveform stays aligned with a ruler over the same stretch. A [`SegmentBar`](/display/segment-bar) takes the same `range`.

```tsx
<Waveform label="Score" levels={levels} duration={225} range={[70, 150]} className="h-8" />
```

## Seeking

With `onValueChange` the waveform is a slider: it takes focus, and a press or a drag calls `onValueChange` with the time under the pointer. `onValueCommitted` follows once the drag lets go, so a player can scrub while the pointer is down and play on after it. Every `onValueChange` between a press and `onValueCommitted` is part of one drag.

The arrow keys move the playhead by `step` seconds, Page Up and Page Down ten steps, and Home and End to either end; each key commits at once. The waveform keeps those keys to itself, so a transport listening for them higher up does not move the playhead a second time. A screen reader hears the position as "01:23 of 03:45".

Inside a player that binds some of those keys to something else, such as Up and Down to jump between sections, `onKeyDown` hears every key first. A key it calls `preventDefault` on, the waveform leaves alone and lets bubble up to the player, so the player's keys work while the waveform has the focus.

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

Without `onValueChange` it only shows, as an image named by its `label`. Leave out `value` as well and it draws no playhead, for a row that already has one of its own.

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
