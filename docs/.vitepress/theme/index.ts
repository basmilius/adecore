import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Demo from './Demo.vue';
import TokenTable from './TokenTable.vue';
import './style.css';

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component('Demo', Demo);
        app.component('TokenTable', TokenTable);
    }
} satisfies Theme;
