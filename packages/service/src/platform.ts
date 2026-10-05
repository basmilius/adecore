import { launchAgentPlist, systemdUnit, type ServiceSpec } from './definitions.js';
import { launchdManager, systemdManager, type LaunchdOptions, type ServiceManager, type SystemdOptions } from './manager.js';

export interface PlatformServiceOptions {
    launchd: LaunchdOptions;
    systemd: SystemdOptions;
}

export function platformServiceManager(platform: NodeJS.Platform, options: PlatformServiceOptions): ServiceManager | null {
    if (platform === 'darwin') {
        return launchdManager(options.launchd);
    }
    if (platform === 'linux') {
        return systemdManager(options.systemd);
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
    throw new Error(`Background services are unsupported on ${platform}.`);
}
