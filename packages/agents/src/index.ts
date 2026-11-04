// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
// The generic helpers moved to @adecore/utils; these names stay until every app imports them from there.
export { wait, withTimeout, cancellableTimeout, unrefTimeout, type Timer, Serializer, KeyedSerializer, SingleFlight } from '@adecore/utils/async';
export { describeError, hasErrorCode, isNotFound } from '@adecore/utils/errors';
export { tempNameFor, writeAtomic, replaceSync, writeAtomicSync, fileExists, entryExists, type WriteAtomicOptions } from '@adecore/utils/fs';
export { CodedError } from './coded-error.ts';
export { setErrorStacks, errorText } from './error-text.ts';
export { RecordDirectory, type RecordDirectoryOptions } from './record-directory.ts';
export { runProcess, type ProcessResult, type RunProcessOptions } from './run-process.ts';
export { cleanTitle, readLines } from './title-file.ts';

export {
    type DirectoryWatcher,
    type WatchSeams,
    supportsRecursive,
    SYSTEM_WATCH,
    type Settled,
    settled,
    PerClientWatches,
    type WatchDirectory,
    type Schedule
} from './watch-seam.ts';
