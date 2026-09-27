import { readFileSync } from 'node:fs';
import type { MarkdownRenderer } from 'vitepress';

const DEMOS = new URL('../demos/', import.meta.url);

/* `<Demo src="actions/button-variants" />` on a line of its own, with an optional flag such as `fill` after it. */
const DEMO_TAG = /^<Demo\s+src="([\w/-]+)"((?:\s+[a-z]+)*)\s*\/>$/;

/*
 * Turns a demo tag into the island that mounts it and the demo file itself, highlighted the way every
 * other code block on the page is. The file is read here, so a demo that does not exist fails the build.
 */
export const demoPlugin = (md: MarkdownRenderer): void => {
    const fence = md.renderer.rules.fence!;

    // VitePress hands a component tag on a line of its own over as inline HTML, a plain renderer as a block.
    for (const rule of ['html_block', 'html_inline'] as const) {
        const html = md.renderer.rules[rule]!;
        md.renderer.rules[rule] = (tokens, index, options, env, self) => {
            const match = DEMO_TAG.exec(tokens[index]!.content.trim());
            if (match === null) {
                return html(tokens, index, options, env, self);
            }
            const [, src, flags] = match;
            const source = readFileSync(new URL(`${src}.tsx`, DEMOS), 'utf8');
            // Tildes, so a backtick fence inside a demo can never close this one.
            const code = fence(md.parse(`~~~~tsx\n${source}~~~~\n`, {}), 0, options, env, self);
            return `<Demo src="${src}"${flags}>${code}</Demo>\n`;
        };
    }
};
