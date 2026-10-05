import i18next from 'i18next';

export const i18n = i18next.createInstance();

const resources = {
    en: {
        app: {
            sidebar: { title: 'Databases', manage: 'Manage connections' },
            connections: { title: 'Connections', close: 'Close' },
            tabs: { label: 'Open tabs', newConsole: 'New console', close: 'Close tab', console: 'Console', views: 'Table views' },
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
            sidebar: { title: 'Databases', manage: 'Verbindingen beheren' },
            connections: { title: 'Verbindingen', close: 'Sluiten' },
            tabs: { label: 'Open tabbladen', newConsole: 'Nieuwe console', close: 'Tabblad sluiten', console: 'Console', views: 'Tabelweergaven' },
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
