<template>
    <table
        v-if="tokens.length > 0"
        class="token-table">
        <thead>
            <tr>
                <th>Token</th>
                <th>Light</th>
                <th>Dark</th>
            </tr>
        </thead>
        <tbody>
            <tr
                v-for="token of tokens"
                :key="token.name">
                <td>
                    <code>--{{ token.name }}</code>
                    <div
                        v-if="token.utility"
                        class="token-utility">
                        <code>{{ utilityOf(token) }}</code>
                    </div>
                </td>
                <td
                    v-for="theme of themes"
                    :key="theme">
                    <div
                        class="token-sample"
                        :data-theme="theme">
                        <span
                            v-if="token.kind !== 'value'"
                            class="token-swatch"
                            :class="`token-swatch-${token.kind}`"
                            :style="swatchStyle(token, theme)"/>
                        <code class="token-value">{{ valueIn(token, theme) }}</code>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>

    <table
        v-if="scale.length > 0"
        class="token-table">
        <thead>
            <tr>
                <th>Token</th>
                <th>Value</th>
                <th v-if="group !== 'spacing'">Sample</th>
            </tr>
        </thead>
        <tbody>
            <tr
                v-for="token of scale"
                :key="token.name">
                <td><code>--{{ token.name }}</code></td>
                <td>
                    <code>{{ token.value }}</code>
                    <div v-if="token.lineHeight">
                        <code>{{ token.lineHeight }}</code>
                    </div>
                </td>
                <td v-if="group !== 'spacing'">
                    <span
                        v-if="group === 'radius'"
                        class="token-radius"
                        :style="{borderRadius: token.value}"/>
                    <span
                        v-else
                        :style="sampleStyle(token)">Build history</span>
                </td>
            </tr>
        </tbody>
    </table>
</template>

<script
    lang="ts"
    setup>
    import { computed, type CSSProperties } from 'vue';
    import type { ScaleToken, ThemeToken } from './theme-tokens.ts';
    import { data } from './tokens.data.ts';

    const {group} = defineProps<{
        readonly group: string;
    }>();

    const themes = ['light', 'dark'] as const;

    type Theme = typeof themes[number];

    const tokens = computed(() => data.tokens.filter(token => token.group === group));
    const scale = computed(() => data.scale.filter(token => token.group === group));

    function valueIn(token: ThemeToken, theme: Theme): string {
        return theme === 'dark' && token.dark !== null ? token.dark : token.light;
    }

    // The raw value, so an expression such as `color-mix(..., var(--surface))` resolves inside the theme it is drawn in.
    function swatchStyle(token: ThemeToken, theme: Theme): CSSProperties {
        const value = valueIn(token, theme);

        if (token.kind === 'shadow') {
            return {boxShadow: value};
        }

        return {background: token.kind === 'channels' ? `rgb(${value})` : value};
    }

    function utilityOf(token: ThemeToken): string {
        return token.kind === 'shadow' ? `shadow-${token.utility}` : `bg-${token.utility}, text-${token.utility}, border-${token.utility}`;
    }

    function sampleStyle(token: ScaleToken): CSSProperties {
        if (group === 'type') {
            return {fontSize: token.value, lineHeight: token.lineHeight ?? undefined};
        }

        if (group === 'font') {
            return {fontFamily: token.value};
        }

        return {lineHeight: token.value};
    }
</script>

<style scoped>
    .token-table {
        display: table;
        width: 100%;
    }

    .token-table code {
        white-space: nowrap;
    }

    .token-utility {
        margin-top: 4px;
        font-size: 12px;
    }

    /* The three utilities may wrap, so the token column leaves the value columns room for a hex on one line. */
    .token-utility code {
        white-space: normal;
    }

    .token-sample {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        background: var(--bg);
        color: var(--text);
    }

    .token-swatch {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        box-shadow: inset 0 0 0 1px var(--border);
    }

    .token-swatch-shadow {
        background: var(--surface-raised);
    }

    /* Breaks only between the words of an expression, never inside a hex or a token name. */
    .token-value {
        font-size: 12px;
        white-space: normal !important;
    }

    .token-radius {
        display: block;
        width: 40px;
        height: 28px;
        border: 1px solid var(--vp-c-text-3);
    }
</style>
