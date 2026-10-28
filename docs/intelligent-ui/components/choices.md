# Choices

Optional follow-ups after finished work. A question the turn waits on (a missing fact, a decision, a go-ahead) is not a Choice; ask it with the question tool, or in prose. A Choice sends its label and context as a message, once, after the reply finished streaming. See [choices](/intelligent-ui/host/choices) for what the host checks.

<Demo src="intelligent-ui/choices" />

```ui
<Summary>Two ways to fix the flaky test</Summary>
<Choices>
<Choice primary={true} context="Wait for the login request before asserting.">Wait for the request</Choice>
<Choice context="Raise the timeout of the login step to ten seconds.">Raise the timeout</Choice>
<Choice disabled={true}>Skip the test</Choice>
</Choices>
```

## Choices and Choice

`Choices` has no props and holds only `Choice`. A `Choice` stands only inside `Choices`; its children are the label.

| Prop       | Type    | Required | Notes                                                                 |
| ---------- | ------- | -------- | --------------------------------------------------------------------- |
| `context`  | string  | No       | The message it sends, shown under the label; the label without one   |
| `primary`  | boolean | No       | The recommended step; it stands first                                 |
| `disabled` | boolean | No       | Shown, but cannot be picked                                           |

Write a short label and a precise context. The context is the agent's next prompt, so it must make sense without the block. Both are visible before a person picks.

The label and the context may read state, evaluated with the values on screen at the pick:

```ui
$scope = "failed"
<Segmented value={$scope}>
<Option value="failed">Failed only</Option>
<Option value="all">Everything</Option>
</Segmented>
<Choices>
<Choice context={"Rerun the " + $scope + " tests on main."}>Rerun</Choice>
</Choices>
```

A block is answered once. After a pick, every Choice and input closes, and the block shows which Choice answered and when.
