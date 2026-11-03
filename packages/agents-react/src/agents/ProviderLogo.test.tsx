import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentIcon } from './AgentIcon';
import { ProviderLogo } from './ProviderLogo';

function pathOf(markup: string): { d: string | undefined; fillRule: string | undefined } {
    return { d: /\sd="([^"]+)"/.exec(markup)?.[1], fillRule: /fill-rule="([^"]+)"/.exec(markup)?.[1] };
}

test('Claude on an API key draws a mark of its own, with the even-odd rule that knocks its letters out', () => {
    const api = pathOf(renderToStaticMarkup(<ProviderLogo provider="anthropic-claude-api" />));
    const claude = pathOf(renderToStaticMarkup(<ProviderLogo provider="claude" />));

    expect(api.d).toBeDefined();
    expect(api.d).not.toBe(claude.d);
    expect(api.fillRule).toBe('evenodd');
    expect(claude.fillRule).toBe('nonzero');
});

test('the agent mark of the API provider is the same logo, named for a screen reader', () => {
    const markup = renderToStaticMarkup(<AgentIcon kind="anthropic-claude-api" />);

    expect(markup).toContain('aria-label="Claude API"');
    expect(pathOf(markup)).toEqual(pathOf(renderToStaticMarkup(<ProviderLogo provider="anthropic-claude-api" />)));
});
