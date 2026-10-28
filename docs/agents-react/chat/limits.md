# Limits

When a turn stops on the plan's usage limit or on an overloaded model, the chat says so until the next turn. The composer draws `LimitDock` itself; `LimitPill` is for a header that shows the chat without its thread.

```tsx
import { LimitDock, LimitPill, ResumeCompactionDock } from '@adecore/agents-react/chat/ui';
```

<Demo src="agents/limits" />

## LimitDock and LimitPill

`LimitDock({ chatId, info })` sits at the top of the composer. It says what stopped the turn and when the limit lifts, with a switch to resume then. `LimitPill({ chatId })` says the same in a few words, from the status every client gets. Both draw nothing while a turn runs or after a normal stop. `limitView(info, now)` returns their words.

The switch sets the chat's `resumeAtReset` through `configure`, and shows only while the host's `useResumeAtReset(scopeId)` allows it. The host decides whether and when the chat resumes.

When another account of the CLI is on, signed in and has room, the dock offers to continue there (`continueOn`). The host decides whether that takes the chat over or forks it. The button names the account with the most session left; with several, a chevron opens a menu of all of them. An account that cannot read the conversation is marked as continuing in a fork. Nothing switches without a press.

## ResumeCompactionDock

`ResumeCompactionDock({ tokens, onCompact, onDismiss })` offers to compact a long context before an idle chat resumes. The composer shows it past `RESUME_COMPACTION_TOKENS` after `RESUME_COMPACTION_IDLE_MS` without a turn, on a CLI that can compact; `resumeCompactionOffer` decides. Sending without answering keeps the whole history.
