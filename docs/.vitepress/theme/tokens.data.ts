import { readFileSync } from 'node:fs';
import { defineLoader } from 'vitepress';
import { readThemeTokens, type ThemeTokens } from './theme-tokens.ts';

declare const data: ThemeTokens;
export { data };

export default defineLoader({
    watch: ['../../../packages/ui/src/theme.css'],
    load: ([theme]): ThemeTokens => readThemeTokens(readFileSync(theme!, 'utf8'))
});
