import type { z } from 'zod';
import type { AgentStatus } from './agent.ts';
import type {
    ChatApprovalItem,
    ChatBackgroundTask,
    ChatEvent,
    ChatGoalStatus,
    ChatItem,
    ChatQuestionItem,
    ChatRequestKind,
    ChatTurnLimit,
    ChatUnknownEvent,
    ChatUnknownItem
} from './chat.ts';
import type { RuntimeMode } from './model.ts';
import type { Task, TaskResult, TaskStatus } from './task.ts';
import type { UsageProvider } from './usage.ts';
import { readStamped, type WireDegradation } from './wire-stamps.ts';

export { lossyItems, openUnion, openValues, wireStampOf, wireStampsIn, type WireDegradation, type WireStamp, type WireStampAt } from './wire-stamps.ts';

declare const unknownWord: unique symbol;

/* A word of a newer host in an open vocabulary: a string, but none of the words this version can switch on. */
export type UnknownWord = string & { readonly [unknownWord]: true };

/* Each open union by the name it is stamped with: the type a strict parse gives and what a member this version cannot read becomes. */
export type OpenUnionTable = Record<string, { readonly known: unknown; readonly unknown: unknown }>;

/* Each open vocabulary by the name it is stamped with, as a strict parse types it. */
export type OpenWordTable = Record<string, unknown>;

export type OpenUnions = {
    ChatItem: { known: ChatItem; unknown: ChatUnknownItem };
    ChatEvent: { known: ChatEvent; unknown: ChatUnknownEvent };
    ChatPendingRequest: { known: ChatApprovalItem | ChatQuestionItem; unknown: ChatUnknownItem };
};

export type OpenWords = {
    AgentStatus: AgentStatus;
    ChatBackgroundTaskKind: ChatBackgroundTask['kind'];
    ChatGoalStatus: ChatGoalStatus;
    ChatRequestKind: ChatRequestKind;
    ChatTurnLimitKind: ChatTurnLimit['kind'];
    RuntimeMode: RuntimeMode;
    TaskPauseKind: NonNullable<Task['paused']>['kind'];
    TaskResultSource: TaskResult['source'];
    TaskStatus: TaskStatus;
    TaskWake: Task['wake'];
    UsageProvider: UsageProvider;
};

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type UnknownMemberOf<T, Unions extends OpenUnionTable> = {
    [K in keyof Unions]: Same<T, Unions[K]['known']> extends true ? Unions[K]['unknown'] : never;
}[keyof Unions];

type IsOpenWord<T, Words extends OpenWordTable> = true extends { [K in keyof Words]: Same<T, Words[K]> }[keyof Words] ? true : false;

// A mapped type over a type parameter keeps an array an array and a tuple a tuple.
type TolerantShape<T, Unions extends OpenUnionTable, Words extends OpenWordTable, Depth extends unknown[]> = T extends object
    ? { [K in keyof T]: TolerantAt<T[K], Unions, Words, [...Depth, unknown]> }
    : T;

/*
 * Stops this deep, which no stamped path reaches, so a recursive type such as a tree of UI blocks ends instead of
 * unfolding without end.
 */
type MaxDepth = 12;

type TolerantAt<T, Unions extends OpenUnionTable, Words extends OpenWordTable, Depth extends unknown[]> = Depth['length'] extends MaxDepth
    ? T
    : [UnknownMemberOf<NonNullable<T>, Unions>] extends [never]
      ? IsOpenWord<NonNullable<T>, Words> extends true
          ? T | UnknownWord
          : TolerantShape<T, Unions, Words, Depth>
      : TolerantShape<NonNullable<T>, Unions, Words, Depth> | UnknownMemberOf<NonNullable<T>, Unions> | Extract<T, null | undefined>;

/*
 * `T` as `readTolerant` may hand it over with these tables: an open union also holds its unknown member, and an open
 * vocabulary also an `UnknownWord`. Types match a table by being the same type, never by one being part of the other.
 */
export type TolerantWith<T, Unions extends OpenUnionTable, Words extends OpenWordTable> = TolerantAt<T, Unions, Words, []>;

/* `T` as `readTolerant` may hand it over with the open unions and vocabularies of these contracts. */
export type Tolerant<T> = TolerantWith<T, OpenUnions, OpenWords>;

export type ToleratedRead<T> =
    | { readonly success: true; readonly data: T; readonly degraded: readonly WireDegradation[] }
    | { readonly success: false; readonly error: z.ZodError };

/*
 * Reads what a host sent the way a client of an older version should: the strict parse when it holds, otherwise
 * every open union, lossy list and open vocabulary stamped below `schema` degrades in place, and `degraded` says
 * where. A host reading what a client sent keeps parsing strictly. An app that stamps schemas of its own passes its
 * tables joined with these (`OpenUnions & AppUnions`) to type what it reads.
 */
export function readTolerant<S extends z.core.$ZodType, Unions extends OpenUnionTable = OpenUnions, Words extends OpenWordTable = OpenWords>(
    schema: S,
    input: unknown
): ToleratedRead<TolerantWith<z.output<S>, Unions, Words>> {
    return readStamped(schema, input) as ToleratedRead<TolerantWith<z.output<S>, Unions, Words>>;
}
