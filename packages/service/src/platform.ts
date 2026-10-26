import { launchAgentPlist, scheduledTask, systemdUnit, type ServiceSpec } from './definitions.js';
import {
    launchdManager,
    systemdManager,
    taskSchedulerManager,
    type LaunchdOptions,
    type ServiceManager,
    type SystemdOptions,
    type TaskSchedulerOptions
} from './manager.js';

export interface PlatformServiceOptions {
    launchd: LaunchdOptions;
    systemd: SystemdOptions;
    /* Without it there is no manager on Windows. */
    taskScheduler?: TaskSchedulerOptions;
}

export function platformServiceManager(platform: NodeJS.Platform, options: PlatformServiceOptions): ServiceManager | null {
    if (platform === 'darwin') {
        return launchdManager(options.launchd);
    }

    if (platform === 'linux') {
        return systemdManager(options.systemd);
    }

    if (platform === 'win32' && options.taskScheduler !== undefined) {
        return taskSchedulerManager(options.taskScheduler);
    }

    return null;
}

export function serviceDefinition(platform: NodeJS.Platform, spec: ServiceSpec): string {
    if (platform === 'darwin') {
        return launchAgentPlist(spec);
    }

    if (platform === 'linux') {
        return systemdUnit(spec);
    }

    if (platform === 'win32') {
        return scheduledTask(spec);
    }

    throw new Error(`Background services are unsupported on ${platform}.`);
}
