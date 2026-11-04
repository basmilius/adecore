// Public API: exports.test.ts snapshots this list, so a name added or dropped here is an API change.
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
