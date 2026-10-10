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

| Prop    | Type   | Required | Notes             |
| ------- | ------ | -------- | ----------------- |
| `title` | string | Yes      | The tab's label   |

The first tab is open. A tab that arrives while the block streams does not take the focus from the one a person opened.

## Sections and Section

Independent topics that fold. `Sections` has no props and holds only `Section`. A `Section` stands only inside `Sections`; its children may hold any component.

| Prop    | Type   | Required | Notes               |
| ------- | ------ | -------- | ------------------- |
| `title` | string | Yes      | The section's head  |

Sections arrive open. Once a person folds one, nothing in that set opens by itself again.
