import { useContext, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code, Workflow } from 'lucide-react';
import { IconButton } from '@adecore/ui';
import { CodeBlock } from './CodeBlock';
import { CodeStreamingContext } from './code-streaming';
import { DIAGRAM_TOKENS, GROUND_TOKEN, renderOptions, svgDataUrl, themedSvg, type DiagramFont } from './mermaid';
import { watchTheme } from './theme-watch';
import { useHostCodeMode } from '../../host-hooks';

interface LaidOut {
    svg: string;
    width: number;
    height: number;
}

type Drawing = { state: 'drawing' } | { state: 'drawn'; image: LaidOut } | { state: 'failed' };

let probeCanvas: HTMLCanvasElement | null = null;

/* A token as an opaque `#rrggbb` over `ground`, so a border with an alpha mixes with the ground and not with what is under the image. */
function resolveColor(element: HTMLElement, token: string, ground: string): string {
    probeCanvas ??= document.createElement('canvas');
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    const context = probeCanvas.getContext('2d', { willReadFrequently: true });
    const value = getComputedStyle(element).getPropertyValue(token).trim();

    if (context === null || value === '') {
        return ground;
    }

    context.fillStyle = ground;
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

    return `#${[red, green, blue].map((channel) => channel!.toString(16).padStart(2, '0')).join('')}`;
}

/* What a diagram reads of the theme where it stands. */
interface DiagramLook {
    colors: Record<string, string>;
    font: DiagramFont;
}

function diagramLook(element: HTMLElement): DiagramLook {
    const style = getComputedStyle(element);
    const ground = resolveColor(element, GROUND_TOKEN, '#808080');

    const colors = Object.fromEntries(
        Object.entries(DIAGRAM_TOKENS).map(([name, token]) => [name, token === GROUND_TOKEN ? ground : resolveColor(element, token, ground)])
    );

    const font = {
        family: style.fontFamily,
        mono: style.getPropertyValue('--font-mono').trim() || 'monospace',
        size: Number.parseFloat(style.fontSize) || 14
    };

    return { colors, font };
}

/* Keeps the look on screen when nothing of it changed, so a change of the root that leaves every color alone draws nothing again. */
function keepingSame(next: DiagramLook) {
    return (current: DiagramLook | null) => (current !== null && JSON.stringify(current) === JSON.stringify(next) ? current : next);
}

async function layOut(id: string, source: string, font: DiagramFont): Promise<LaidOut> {
    const { renderAsync } = await import('pele/lazy');
    const { svg, width, height } = await renderAsync(source, renderOptions(font, id));

    return { svg, width: Math.ceil(width), height: Math.ceil(height) };
}

/*
 * A ```mermaid fence, drawn as the diagram once the fence is closed. Pele loads on the first diagram of the
 * page, and then only what a diagram of that kind needs. While the fence grows, and when the text is no diagram
 * Pele can draw, it is the code block it would otherwise be.
 */
export function MermaidBlock({ code }: { code: string }) {
    const { t } = useTranslation('agent-chat');
    const streaming = useContext(CodeStreamingContext);
    const dark = useHostCodeMode() === 'dark';
    const id = `mermaid-${useId().replace(/[^\w-]/g, '')}`;
    const frame = useRef<HTMLDivElement>(null);
    const [source, setSource] = useState(false);
    const [drawing, setDrawing] = useState<Drawing>({ state: 'drawing' });
    const [look, setLook] = useState<DiagramLook | null>(null);

    useEffect(() => {
        const element = frame.current;

        if (element !== null) {
            setLook(keepingSame(diagramLook(element)));
        }
    }, [dark]);

    // An app may change its colors without turning light or dark, which only the root of the page tells.
    useEffect(() => {
        const element = frame.current;

        if (element === null) {
            return;
        }

        return watchTheme(element.ownerDocument, () => setLook(keepingSame(diagramLook(element))));
    }, []);

    const fontFamily = look?.font.family;
    const fontMono = look?.font.mono;
    const fontSize = look?.font.size;

    useEffect(() => {
        if (streaming || fontFamily === undefined || fontMono === undefined || fontSize === undefined) {
            return;
        }

        let cancelled = false;

        // A diagram already drawn stays until the next one is there, so it does not blink.
        layOut(id, code, { family: fontFamily, mono: fontMono, size: fontSize }).then(
            (image) => !cancelled && setDrawing({ state: 'drawn', image }),
            () => !cancelled && setDrawing({ state: 'failed' })
        );

        return () => {
            cancelled = true;
        };
    }, [code, fontFamily, fontMono, fontSize, id, streaming]);

    const image = drawing.state === 'drawn' && look !== null ? { ...drawing.image, svg: themedSvg(drawing.image.svg, look.colors) } : null;
    const showsDiagram = !streaming && !source && drawing.state !== 'failed';

    const toggle =
        streaming || drawing.state === 'failed' ? undefined : (
            <IconButton
                icon={source ? Workflow : Code}
                size="sm"
                label={source ? t('code.mermaid.showDiagram') : t('code.mermaid.showSource')}
                onClick={() => setSource((shown) => !shown)}
            />
        );

    return (
        // One tree in every state, so the code block keeps the lines it has when the fence closes.
        <div ref={frame}>
            <CodeBlock
                code={code}
                lang="mermaid"
                actions={toggle}
                view={
                    showsDiagram ? (
                        <div className="overflow-x-auto p-3" aria-busy={image === null || undefined}>
                            {image !== null && (
                                <img
                                    src={svgDataUrl(image.svg)}
                                    width={image.width}
                                    height={image.height}
                                    alt={t('code.mermaid.diagram')}
                                    className="m-0 max-w-none"
                                    draggable={false}
                                />
                            )}
                        </div>
                    ) : undefined
                }
            />
            {drawing.state === 'failed' && <p className="m-0 mt-1 text-xs text-text-faint">{t('code.mermaid.failed')}</p>}
        </div>
    );
}
