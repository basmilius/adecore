import { createContext } from 'react';

/*
 * How far up from its bottom the composer covers a view that stands in the thread's place, such as a
 * sub-agent's conversation, so that view scrolls on under the card and fades out the way the thread does.
 */
export const CoveredBottomContext = createContext(0);
