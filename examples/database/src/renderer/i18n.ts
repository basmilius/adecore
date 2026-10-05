import i18next from 'i18next';

export const i18n = i18next.createInstance();

const resources = {
    en: {
        app: {
            title: 'adecore database',
            layout: { label: 'Layout', workbench: 'Workbench', pane: 'Side pane' },
            sidebar: { title: 'Databases', manage: 'Manage connections' },
            connections: { title: 'Connections', close: 'Close' },
            tabs: {
                label: 'Open tabs',
                newConsole: 'New console',
                console: 'Console',
                views: 'Table views',
                filtered: '{{table}} (filtered)',
                newTable: 'New table',
                designer: 'Design {{table}}'
            },
            views: { data: 'Data', structure: 'Structure' },
            empty: {
                title: 'Nothing open',
                body: 'Open a table from the explorer, start a console or manage your connections.',
                console: 'New console'
            }
        }
    },
    nl: {
        app: {
            title: 'adecore database',
            layout: { label: 'Indeling', workbench: 'Werkbank', pane: 'Zijpaneel' },
            sidebar: { title: 'Databases', manage: 'Verbindingen beheren' },
            connections: { title: 'Verbindingen', close: 'Sluiten' },
            tabs: {
                label: 'Open tabbladen',
                newConsole: 'Nieuwe console',
                console: 'Console',
                views: 'Tabelweergaven',
                filtered: '{{table}} (gefilterd)',
                newTable: 'Nieuwe tabel',
                designer: 'Ontwerp {{table}}'
            },
            views: { data: 'Gegevens', structure: 'Structuur' },
            empty: {
                title: 'Niets geopend',
                body: 'Open een tabel in de verkenner, start een console of beheer je verbindingen.',
                console: 'Nieuwe console'
            }
        }
    }
};

void i18n.init({
    lng: navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en',
    fallbackLng: 'en',
    ns: ['app'],
    defaultNS: 'app',
    resources,
    interpolation: { escapeValue: false },
    initAsync: false
});
