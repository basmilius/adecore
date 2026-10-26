import { describe, expect, test } from 'bun:test';
import { positionPorts, type Port } from './use-slots.ts';

type Access = 'read' | 'write';

// An element that logs every layout read and every style write, which is all the order of a pass needs.
const element = (log: Access[]): HTMLElement => {
    const read = (value: number): number => {
        log.push('read');

        return value;
    };

    const properties = new Map<string, string>();

    const style = new Proxy(
        {
            getPropertyValue: (name: string): string => properties.get(name) ?? '',
            setProperty: (name: string, value: string): void => {
                log.push('write');
                properties.set(name, value);
            }
        } as Record<string | symbol, unknown>,
        {
            set: (target, property, value) => {
                log.push('write');
                target[property] = value;

                return true;
            }
        }
    );

    let section: HTMLElement | undefined;

    return {
        style,
        childNodes: [null],
        get offsetTop() {
            return read(50);
        },
        get offsetLeft() {
            return read(10);
        },
        get offsetWidth() {
            return read(200);
        },
        getBoundingClientRect: () => ({ width: read(13.5) }),
        querySelector: () => (section ??= element(log))
    } as unknown as HTMLElement;
};

const port = (log: Access[]): Port => ({
    rowElement: element(log),
    control: element(log),
    decoration: element(log),
    lightControl: element(log),
    lightDecoration: element(log)
});

// Each turn from reading to writing or back; a read after a write forces a layout.
const phasesOf = (log: Access[]): Access[] => log.filter((access, i) => access !== log[i - 1]);

describe('positioning the ports of a file tree', () => {
    test('forces two layouts at most, however many rows are mounted', () => {
        const log: Access[] = [];
        const ports = Array.from({ length: 60 }, () => port(log));
        positionPorts(ports);
        expect(phasesOf(log)).toEqual(['read', 'write', 'read', 'write']);
        expect(ports[0]!.rowElement.style.getPropertyValue('--adecore-tree-control-space')).toBe('20px');
        expect(ports[0]!.control.style.top).toBe('50px');
        expect(ports[0]!.control.style.left).toBe('0px');
        expect(ports[0]!.decoration.style.left).toBe('226px');
    });

    test('puts the decoration after the git status column when asked, and keeps the space after that column', () => {
        const log: Access[] = [];
        const placed = port(log);

        const sections = new Map<string, HTMLElement>([
            ['[data-item-section="content"]', { offsetLeft: 30, offsetWidth: 100 } as HTMLElement],
            ['[data-item-section="git"]', { offsetLeft: 140, offsetWidth: 16 } as HTMLElement],
            ['[data-item-section="icon"]', { offsetLeft: 4 } as HTMLElement]
        ]);

        placed.rowElement.querySelector = ((selector: string) => sections.get(selector) ?? null) as HTMLElement['querySelector'];
        positionPorts([placed], 'after-status');
        expect(placed.decoration.style.left).toBe('172px');
        expect(placed.rowElement.style.getPropertyValue('--adecore-tree-status-space')).toBe('20px');
        expect(placed.rowElement.style.getPropertyValue('--adecore-tree-decoration-space')).toBe('0px');
        positionPorts([placed]);
        expect(placed.decoration.style.left).toBe('146px');
        expect(placed.rowElement.style.getPropertyValue('--adecore-tree-decoration-space')).toBe('20px');
    });

    test('measures once when the spaces stay what they were', () => {
        const log: Access[] = [];
        const ports = Array.from({ length: 60 }, () => port(log));
        positionPorts(ports);
        log.length = 0;
        positionPorts(ports);
        expect(phasesOf(log)).toEqual(['read', 'write']);
    });
});
