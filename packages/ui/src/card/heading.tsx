import { createElement, use, type ComponentProps } from 'react';
import { HeadingLevelContext, headingTag } from './context.ts';

/* A heading one level below the titled grid around it, or an `<h2>` outside one. */
export function LevelHeading(props: ComponentProps<'h2'>) {
    return createElement(headingTag(use(HeadingLevelContext)), props);
}
