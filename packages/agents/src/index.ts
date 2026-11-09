// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
export { CodedError } from './coded-error.ts';
export { setErrorStacks, errorText } from './error-text.ts';
export { RecordDirectory } from './record-directory.ts';
export { runProcess, type ProcessResult } from './run-process.ts';
export { cleanTitle, readLines } from './title-file.ts';

export {
    type DirectoryWatcher,
    type WatchSeams,
    supportsRecursive,
    SYSTEM_WATCH,
    type Settled,
    settled,
    PerClientWatches,
    type Schedule
} from './watch-seam.ts';
