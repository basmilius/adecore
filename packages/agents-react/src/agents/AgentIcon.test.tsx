import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatHostProvider, type AgentMark } from '../host/host';
import { AgentIcon } from './AgentIcon';

function draw(kind: string, agentMarks?: Record<string, AgentMark>): string {
    const icon = createElement(AgentIcon, { kind });

    return renderToStaticMarkup(agentMarks === undefined ? icon : createElement(ChatHostProvider, { host: { agentMarks } }, icon));
}

describe('AgentIcon', () => {
    test('a built-in kind wears its own mark in a 24 by 24 box', () => {
        const markup = draw('claude');
        expect(markup).toContain('aria-label="Claude"');
        expect(markup).toContain('viewBox="0 0 24 24"');
    });

    test('a kind the host added wears the mark the host gave it', () => {
        const markup = draw('antigravity', { antigravity: { title: 'Antigravity', path: 'M1 1h22v22H1Z' } });
        expect(markup).toContain('aria-label="Antigravity"');
        expect(markup).toContain('d="M1 1h22v22H1Z"');
        expect(markup).not.toContain('lucide-bot');
    });

    test('a host mark keeps the box it was drawn in', () => {
        expect(draw('antigravity', { antigravity: { title: 'Antigravity', path: 'M0 0h16v16H0Z', viewBox: '0 0 16 16' } })).toContain('viewBox="0 0 16 16"');
    });

    test('a host may draw a built-in kind its own way', () => {
        expect(draw('claude', { claude: { title: 'Claude', path: 'M2 2h20v20H2Z' } })).toContain('d="M2 2h20v20H2Z"');
    });

    test('a kind without any mark is a robot, also when the host gave others', () => {
        expect(draw('mystery', { antigravity: { title: 'Antigravity', path: 'M1 1h22v22H1Z' } })).toContain('lucide-bot');
    });

    test('a layer inside another adds its marks to the ones above it', () => {
        const inner = createElement(
            ChatHostProvider,
            { host: { agentMarks: { antigravity: { title: 'Antigravity', path: 'M1 1h22v22H1Z' } } } },
            createElement(AgentIcon, { kind: 'claude' })
        );
        const markup = renderToStaticMarkup(
            createElement(ChatHostProvider, { host: { agentMarks: { claude: { title: 'Mine', path: 'M2 2h20v20H2Z' } } } }, inner)
        );
        expect(markup).toContain('aria-label="Mine"');
    });
});
