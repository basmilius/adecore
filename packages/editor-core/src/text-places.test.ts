import { describe, expect, it } from 'bun:test';
import { DocumentModel } from './document.ts';

/* Marks the offset with `|` and removes the mark. */
function place(marked: string, language: string) {
    const offset = marked.indexOf('|');

    return new DocumentModel(marked.replace('|', '')).placeAt(offset, language);
}

describe('placeAt', () => {
    it('tells code, comments and strings apart', () => {
        expect(place('const a = |1;', 'typescript')).toEqual({ language: 'typescript', kind: 'code' });
        expect(place('// no|te', 'typescript').kind).toBe('comment');
        expect(place('/* no|te */', 'typescript').kind).toBe('comment');
        expect(place("const a = 'st|r';", 'typescript').kind).toBe('string');
        expect(place('const a = `st|r`;', 'typescript').kind).toBe('string');
        expect(place('const a = `${|b}`;', 'typescript').kind).toBe('code');
    });

    it('keeps the language of a document without regions', () => {
        expect(place('a { b|: c }', 'css').language).toBe('css');
        expect(place('x|', 'plaintext')).toEqual({ language: 'plaintext', kind: 'code' });
    });

    it('resolves the regions of a Vue file', () => {
        expect(place('<template>\n  <div>|</div>\n</template>', 'vue').language).toBe('html');
        expect(place('<template>\n</template>\n<script setup lang="ts">\nconst a = |1;\n</script>', 'vue').language).toBe('typescript');
        expect(place('<script>\nconst a = |1;\n</script>', 'vue').language).toBe('javascript');
        expect(place('<script lang="tsx">\nconst a = |1;\n</script>', 'vue').language).toBe('typescript');
        expect(place('<style>\na { b|: c }\n</style>', 'vue').language).toBe('css');
        expect(place('<style lang="scss">\na { b|: c }\n</style>', 'vue').language).toBe('scss');
        expect(place('<script lang="ts">\nconst a = 1;\n</script>\n|', 'vue').language).toBe('html');
        expect(place('<script lang="ts">|\nconst a = 1;\n</script>', 'vue').language).toBe('html');
    });

    it('resolves the regions of PHP', () => {
        expect(place('<?php\n$a = |1;', 'php').language).toBe('php');
        expect(place('<div>|</div>\n<?php echo 1; ?>', 'php').language).toBe('html');
        expect(place('<?php echo 1; ?>\n<div>|</div>', 'php').language).toBe('html');
        expect(place('<?php /* no|te */', 'php')).toEqual({ language: 'php', kind: 'comment' });
        expect(place('<div class="a|b"></div>\n<?php ?>', 'php')).toEqual({ language: 'html', kind: 'string' });
        expect(place('<style>\na { b|: c }\n</style>\n<?php ?>', 'php').language).toBe('css');
        expect(place('<script>\nconst a = |1;\n</script>\n<?php ?>', 'php').language).toBe('javascript');
    });

    it('finds a script and a style element of a plain markup file', () => {
        expect(place('<div>|</div>', 'html').language).toBe('html');
        expect(place('<script>\nlet a = |1;\n</script>', 'html').language).toBe('javascript');
        expect(place('<style>\na { b|: c }\n</style>', 'html').language).toBe('css');
        expect(place('<script src="a.js"></script>\n<div>|</div>', 'html').language).toBe('html');
        expect(place('<script>\nlet a;\n</script>\n<p>|</p>', 'html').language).toBe('html');
    });

    it('reads the children of JSX as markup', () => {
        expect(place('const a = <div>|</div>;', 'typescriptreact').language).toBe('html');
        expect(place('const a = <div>{|b}</div>;', 'typescriptreact').language).toBe('typescriptreact');
        expect(place('const a = |1;', 'typescriptreact').language).toBe('typescriptreact');
    });
});
