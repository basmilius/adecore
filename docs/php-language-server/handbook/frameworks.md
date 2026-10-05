# Frameworks and test support

Framework support activates from installed Composer packages. No Laravel/Symfony service boots and no application code runs. Overlay PHP files are analysis data, read by the index rather than executed.

## Laravel and Symfony

`laravel/framework` or `illuminate/*` enables applicable facade and Eloquent analysis; the full framework enables application conventions. `symfony/framework-bundle` enables Symfony support, and `doctrine/orm` enables repository/entity support.

Laravel analysis follows literal facade accessors, Eloquent attributes from migrations/schema dumps, casts, relations, accessors, scopes, builder generics and factories. It reads recognized provider bindings and framework aliases for container return types. Known string contexts offer route/config/view/translation/environment/ability/form-request names with navigation and, where reliable, diagnostics.

Symfony analysis follows recognized service YAML/PHP configuration, aliases/resources, route attributes/configuration, templates, translations, parameters and event classes/constants. Doctrine repositories and mapped entity fields contribute types and completion. This does not provide DQL or query-builder string analysis.

An unknown-string diagnostic is deliberately suppressed when the source is incomplete or dynamic. Laravel routes built in loops, computed config keys, package-provided views and dynamic bindings do not become reliable missing-name findings. Environment support reads variable names, never values.

## Templates and current limits

Twig has no template language model: includes, filters and variables are not completed. Blade has minimal embedded reading, but does not track full `@foreach` scope, props, slots, component attributes or Livewire. PHP inside a Blade directive cannot import a class through the current model.

Laravel columns added by raw SQL or another connection, computed table names, contextual/outside-provider container bindings and some dynamic casts/relations remain unknown. Auth analysis uses the first configured provider, not every named guard. Symfony tags/autoconfiguration and unrecognized route loaders are incomplete. Names inside YAML and Twig documents do not gain PHP string completion.

Livewire, Inertia, DQL, Eloquent query strings, validation-rule strings, other framework overlays and a persistent framework-string reference index remain roadmap work. Framework definition/completion support does not imply complete find-usages or rename of route/config/service strings.

## PHPUnit and Pest

The server follows recognized PHPUnit provider/dependency/coverage attributes and docs for navigation, test-double types, Pest datasets/test-case bindings, closure `$this`, expectation chains and custom expectations. Literal test descriptions produce run markers. A computed description is not listed as a runnable.

For an open document, request:

```json
{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "php/runnables",
    "params": { "uri": "file:///project/tests/ExampleTest.php" }
}
```

`params.textDocument.uri` is also accepted. The result is a list in file order. Each record has `kind`, `scope`, `label`, `range`, `filter`, `file` and `configFile`. `kind` can be `phpunit`, `pest`, `artisan` or `console`. `scope` identifies a class, method, test, describe block, architecture test or command. `configFile` is the nearest supported PHPUnit configuration file, or `null`.

For tests, `filter` is a delimited PHPUnit/Pest regex; use it with the returned file rather than rebuilding it from the display label. For Artisan/console commands it is the literal command name. Treat all returned run metadata as data requiring the host's normal execution authorization.

`textDocument/codeLens` exposes the same list with command `php.runTest` and one runnable argument. That command is client owned and is not an advertised server execute command. The host registers it, validates the project/executable and runs the chosen test tool or framework command. The server itself runs no tests and invokes no PHP interpreter.

Keep shell quoting and process cancellation in the host. Prefer an executable plus argument array to a synthesized shell command. Model run results separately from LSP diagnostics, and keep test execution permission independent of permission to read/index a project.
