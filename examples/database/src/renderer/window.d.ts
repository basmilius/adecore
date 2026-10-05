import type { DatabaseBridge } from '../shared/bridge.ts';

declare global {
    interface Window {
        readonly database: DatabaseBridge;
    }
}
