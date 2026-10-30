export { definitionRunsProgram, launchAgentPlist, scheduledTask, scheduledTaskScript, systemdUnit, type ServiceSpec } from './definitions.js';
export {
    launchdManager,
    systemdManager,
    taskSchedulerManager,
    type CommandResult,
    type CommandRunner,
    type LaunchdOptions,
    type ServiceFiles,
    type ServiceManager,
    type SystemdOptions,
    type TaskSchedulerOptions
} from './manager.js';
export { platformServiceManager, serviceDefinition, type PlatformServiceOptions } from './platform.js';
export { diskFiles, runCommand } from './system.js';
