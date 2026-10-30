import { describe, expect, test } from 'bun:test';
import { platformServiceManager, serviceDefinition, type PlatformServiceOptions } from './platform.js';
import type { ServiceSpec } from './definitions.js';

const options: PlatformServiceOptions = {
    launchd: {
        label: 'com.example.worker',
        uid: 501,
        home: '/Users/ada',
        logFile: '/var/log/example/worker.log',
        run: () => ({ code: 0, stdout: '', stderr: '' }),
        files: { read: () => null, write() {}, remove() {}, makeDirectory() {} },
        sleep: async () => {}
    },
    systemd: {
        unitName: 'example-worker.service',
        configHome: '/home/ada/.config',
        user: 'ada',
        run: () => ({ code: 0, stdout: '', stderr: '' }),
        files: { read: () => null, write() {}, remove() {}, makeDirectory() {} }
    }
};

const spec: ServiceSpec = {
    label: 'com.example.worker',
    description: 'Example worker',
    program: '/opt/example/worker',
    args: [],
    environment: { WORKER_HOME: '/home/ada/.example' },
    workingDirectory: '/home/ada',
    logFile: '/var/log/example/worker.log'
};

describe('platform selection', () => {
    test('uses caller identity and paths on each supported platform', () => {
        expect(platformServiceManager('darwin', options)?.path).toBe('/Users/ada/Library/LaunchAgents/com.example.worker.plist');
        expect(platformServiceManager('linux', options)?.path).toBe('/home/ada/.config/systemd/user/example-worker.service');
    });

    test('does not create a manager on unsupported platforms', () => {
        expect(platformServiceManager('win32', options)).toBeNull();
        expect(platformServiceManager('freebsd', options)).toBeNull();
        expect(() => serviceDefinition('freebsd', spec)).toThrow('unsupported');
    });

    test('manages a scheduled task on Windows once it has the options for one', () => {
        const manager = platformServiceManager('win32', {
            ...options,
            taskScheduler: {
                taskName: 'Example Worker',
                definitionFile: 'C:\\Users\\ada\\AppData\\Local\\Example\\worker.xml',
                logFile: 'C:\\Users\\ada\\AppData\\Local\\Example\\worker.log',
                run: () => ({ code: 0, stdout: '', stderr: '' }),
                files: { read: () => null, write() {}, remove() {}, makeDirectory() {} },
                sleep: async () => {}
            }
        });

        expect(manager?.kind).toBe('task-scheduler');
        expect(serviceDefinition('win32', { ...spec, user: 'PC\\ada', scriptDirectory: 'C:\\service' })).toContain('<UserId>PC\\ada</UserId>');
    });

    test('renders caller environment and description without adding product defaults', () => {
        expect(serviceDefinition('darwin', spec)).toContain('<key>WORKER_HOME</key>');
        expect(serviceDefinition('linux', spec)).toContain('Description=Example worker');
        expect(serviceDefinition('linux', { ...spec, description: '100% worker' })).toContain('Description=100%% worker');
    });
});
