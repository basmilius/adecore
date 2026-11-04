import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import Demo from './Demo.vue';
import HomeAreas from './HomeAreas.vue';
import HomeShowcase from './HomeShowcase.vue';
import Logo from './Logo.vue';
import TokenTable from './TokenTable.vue';
import './style.css';

export default {
    extends: DefaultTheme,
    Layout() {
        return h(DefaultTheme.Layout, null, {
            'nav-bar-title-before': () => h(Logo),
            'home-hero-info-before': () => h(Logo, { variant: 'hero' })
        });
    },
    enhanceApp({ app }) {
        app.component('Demo', Demo);
        app.component('HomeAreas', HomeAreas);
        app.component('HomeShowcase', HomeShowcase);
        app.component('TokenTable', TokenTable);
    }
} satisfies Theme;
