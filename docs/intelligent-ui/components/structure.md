# Structure

Organize distinct topics. Use Tabs for alternatives a person compares, and Sections for independent topics they may skip.

<Demo src="intelligent-ui/structure" />

```ui
<Tabs>
<Tab title="Option A">Keep the cache and raise its limit.</Tab>
<Tab title="Option B">Drop the cache and read from disk.</Tab>
</Tabs>
<Sections>
<Section title="What changed">Two files, both in the loader.</Section>
<Section title="Risks">None found.</Section>
</Sections>
```

## Tabs and Tab

Alternatives, one visible at a time. `Tabs` has no props and holds only `Tab`. A `Tab` stands only inside `Tabs`; its children are the panel and may hold any component.

| Prop    | Type   | Required | Notes                                           |
| ------- | ------ | -------- | ----------------------------------------------- |
| `title` | string | Yes      | The tab's label                                 |
| `badge` | string | No       | A short label beside the title, such as a count |

The first tab is open. A tab that arrives while streaming does not take over the one a person opened.

## Sections and Section

Independent topics that fold. `Sections` has no props and holds only `Section`. A `Section` stands only inside `Sections`; its children may hold any component.

| Prop    | Type     | Required | Notes                                     |
| ------- | -------- | -------- | ----------------------------------------- |
| `title` | string   | Yes      | The section's head                        |
| `open`  | boolean  | No       | `false` for a section that starts folded  |
| `badge` | string   | No       | A short label in the head                 |
| `tone`  | `UiTone` | No       | What the section means, such as `warning` |

Sections arrive open. Once a person folds one, none in that set reopens by itself.

## Columns and Pane

Two or three things side by side, such as before and after. `Columns` has no props and holds only `Pane`, two or three of them. A `Pane` stands only inside `Columns`; its children may hold any component and stack as in a Tab.

| Pane prop | Type   | Required | Notes                       |
| --------- | ------ | -------- | --------------------------- |
| `title`   | string | No       | A small line above the pane |

```ui
<Columns>
<Pane title="Before"><Callout tone="warning">Every keystroke draws the whole list.</Callout></Pane>
<Pane title="After"><Callout tone="success">Only the changed row draws again.</Callout></Pane>
</Columns>
```

The panes share the width of the block. In a block narrower than 420px they stack, in the order written.

## Alternatives, Alternative, Pro and Con

Two to four options compared side by side. `Alternatives` has no props and holds only `Alternative`. The words in an `Alternative` describe it; its `Pro` and `Con` children argue it, each a point in its own words.

| Alternative prop | Type    | Required | Notes                                        |
| ---------------- | ------- | -------- | -------------------------------------------- |
| `title`          | string  | Yes      | The name of the option                       |
| `recommended`    | boolean | No       | Outlines the card and tags it as recommended |

```ui
<Alternatives>
<Alternative title="In the compiler" recommended>
One place for every component.
<Pro>No schema changes</Pro>
<Con>One more step before the schema reads</Con>
</Alternative>
<Alternative title="Per prop">
As one prop does today.
<Con>Easy to forget on a new prop</Con>
</Alternative>
</Alternatives>
```

Alternatives only shows the options. A person picks one with a [Choice](/intelligent-ui/components/choices) under it, or through the agent's own question tool. A point for is marked with a plus and a point against with a minus, and a screen reader hears which is which. The cards stack in a block narrower than 420px.

## Tree, Branch and Leaf

A hierarchy, such as folders and files or modules and their parts. `Tree` has no props and holds `Branch` and `Leaf`. A `Branch` holds more of both and folds. A `Leaf` is an end; its children are its name.

| Branch prop | Type    | Required | Notes                                   |
| ----------- | ------- | -------- | --------------------------------------- |
| `label`     | string  | Yes      | The name of the branch                  |
| `open`      | boolean | No       | `false` for a branch that starts folded |

| Leaf prop | Type     | Required | Notes                                                                          |
| --------- | -------- | -------- | ------------------------------------------------------------------------------ |
| `path`    | string   | No       | A file the leaf opens, as a [File](/intelligent-ui/components/links#file) does |
| `detail`  | string   | No       | Faint text at the end of the row, such as `changed`                            |
| `tone`    | `UiTone` | No       | The color of the name; a screen reader hears the tone as a word                |

```ui
<Tree>
<Branch label="src">
<Leaf path="src/compiler.ts" detail="changed"/>
<Leaf detail="new" tone="success">normalize.ts</Leaf>
</Branch>
</Tree>
```

A Leaf with `path` and no children is named after the file. The host checks the path like any [link](/intelligent-ui/host/links): the name opens the file once the host says it can, and stays text when not. A fold a person makes lasts as long as the page.
