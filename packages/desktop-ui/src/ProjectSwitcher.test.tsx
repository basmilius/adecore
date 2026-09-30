import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import * as Menu from './menu/index.parts.ts';
import { ProjectSwitcherRow } from './project-switcher-row.tsx';
import { ProjectSwitcher, type ProjectSwitcherItem, type ProjectSwitcherProps } from './ProjectSwitcher.tsx';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);
const project: ProjectSwitcherItem = { id: 'studio', name: 'Studio', icon: <span aria-hidden>Folder</span> };

describe('a project switcher', () => {
    test('names the current project even when it is absent from the lists, with its leading indicator and icon', () => {
        const markup = render(<ProjectSwitcher current={project} projects={[]} leading={<span>Machine</span>} className="app-switcher" onSelect={() => {}} />);
        expect(markup).toContain('project-switcher-trigger app-switcher');
        expect(markup).toContain('aria-label="Studio"');
        expect(markup.indexOf('Machine')).toBeLessThan(markup.indexOf('Folder'));
        expect(markup.indexOf('Folder')).toBeLessThan(markup.indexOf('>Studio</span>'));
        expect(markup).toContain('aria-haspopup="menu"');
    });

    test('has a name without a current project and accepts an accessible label and disabled state', () => {
        const markup = render(<ProjectSwitcher current={null} projects={[]} label="Switch workspace" disabled onSelect={() => {}} />);
        expect(markup).toContain('>Projects</span>');
        expect(markup).toContain('aria-label="Switch workspace"');
        expect(markup).toContain('disabled=""');
    });

    test('accepts app-specific fields without exposing them on the trigger', () => {
        type Item = ProjectSwitcherItem & { folder: string };
        const item: Item = { ...project, folder: '/projects/studio' };
        const props: ProjectSwitcherProps<Item> = {
            current: item,
            projects: [item],
            onSelect: (selected) => {
                const folder: string = selected.folder;
                void folder;
            }
        };
        const markup = render(<ProjectSwitcher {...props} />);
        expect(markup).toContain('Studio');
        expect(markup).not.toContain(item.folder);
    });
});

describe('a project row', () => {
    const row = (item: ProjectSwitcherItem): string =>
        render(
            <Menu.Root>
                <ProjectSwitcherRow project={item} onSelect={() => {}} />
            </Menu.Root>
        );

    test('draws its hint without disabling a muted, disconnected project', () => {
        const markup = row({ ...project, hint: 'Laptop', muted: true, description: '/projects/studio' });
        expect(markup).toContain('opacity-50');
        expect(markup).toContain('>Laptop</span>');
        expect(markup).toContain('role="menuitem"');
        expect(markup).not.toContain('data-disabled');
        expect(markup).not.toContain('project-switcher-actions');
    });

    test('disables selection of an unavailable project', () => {
        const markup = row({ ...project, disabled: true });
        expect(markup).toContain('data-disabled');
        expect(markup).toContain('aria-disabled="true"');
    });
});

describe("the project switcher's words", () => {
    test('reads the empty trigger in Dutch', async () => {
        const dutch = i18next.createInstance();
        await dutch.init({ lng: 'nl', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });
        const markup = renderToStaticMarkup(
            <UIProvider i18n={dutch}>
                <ProjectSwitcher current={null} projects={[]} onSelect={() => {}} />
            </UIProvider>
        );
        expect(markup).toContain('aria-label="Projecten"');
        expect(markup).toContain('>Projecten</span>');
    });
});
