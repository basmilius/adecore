# PanelHeader

The bar across the top of a side panel, 48 pixels tall to line up with a toolbar beside it: the panel's name, its own controls, and a close button last.

```tsx
import { PanelHeader } from '@basmilius/desktop-ui';
```

<Demo src="display/panel-header" />

`title` draws the name as a [`SectionLabel`](/desktop-ui/display/section-label). Leave it out when you lay out the name yourself. Put a growing spacer between the name and the controls to push them to the end.

`PanelHeader` renders a `<header>` and takes its props, `title?: ReactNode`, `className`, `ref` and `render`. `PanelHeaderProps` is an exported type.
