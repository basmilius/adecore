import { describe, expect, test } from 'bun:test';
import { isValidElement } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ReferenceIconProps } from '../../host';
import { referenceGlyph } from './reference-icons';

function HostIcon(_props: ReferenceIconProps) {
    return null;
}

describe('referenceGlyph', () => {
    test("draws the host's mark with what the reference points at", () => {
        const mark = referenceGlyph(HostIcon, { id: 'view-q3', kind: 'chat', size: 14, className: 'faint' });

        expect(isValidElement(mark) && mark.type).toBe(HostIcon);
        expect(isValidElement(mark) && mark.props).toEqual({ id: 'view-q3', kind: 'chat', size: 14, className: 'faint' });
    });

    test('draws the mark of the kind without a host mark', () => {
        const mark = referenceGlyph(null, { id: 'view-q3', kind: 'chat', size: 12 });

        expect(isValidElement(mark) && (mark.props as { icon: unknown }).icon).toBe(MessageSquare);
    });
});
