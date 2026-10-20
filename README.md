# SIMAI Framework for VS Code

Autocomplete, hovers and colour swatches for
[SIMAI Framework](https://github.com/simai/ui) in VS Code.

## Features

### Components

Type `<sf-` in HTML, JSX/TSX, a Vue template or a Blade/PHP template to get the SIMAI Framework
custom elements, such as `sf-button`, `sf-input` or `sf-tabs`. Inside a tag,
the extension suggests its attributes and, for attributes with a fixed set of
values, the values themselves:

```html
<sf-button appearance="tonal" size="1/2" icon-start="check">Save</sf-button>
```

Deprecated attributes are struck through and name their replacement.

![sf- tag completion in HTML](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-tags.png)

![Attribute values from the component manifest](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-attributes.png)

### Utility classes

Utility classes complete in `class` and `className` attributes, including
breakpoint variants such as `md:flex`. In stylesheets they complete as
escaped selectors (`.md\:flex`).

![Utility classes in a JSX className](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-classes.png)

### Design tokens

Type `var(--sf-` to get every `--sf-*` token of the Framework core: colour
roles, radius, spacing, typography, control sizes, icons, opacity, z-index,
elevation and motion, plus the public variables of the components. Each
suggestion shows its resolved value:

- colour tokens show a swatch and their light and dark values;
- adaptive sizes show their mobile and desktop values.

Colour tokens in your files get inline swatches. Opening the colour picker
on one offers the nearest SIMAI Framework colour tokens.

![Colour tokens with swatches](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-colors.png)

### Hovers

Hover a token, utility class, `sf-` tag or attribute to see what it is, its
values (light/dark, mobile/desktop), the Framework release it comes from and
its lifecycle (released, experimental or deprecated).

![Hover with mobile and desktop values](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-hover.png)

### Diagnostics and Quick Fixes

The extension points out deprecated `sf-` tags and attributes (Warning) and
likely misspellings of SIMAI Framework tokens, tags and attributes
(Information), such as `var(--sf-primay)` or `<sf-button apperance>`. A Quick
Fix replaces the name with the nearest valid one. To avoid noise, a name counts
as unknown only when it is a near miss of a real Framework name: your own
custom properties and elements, component-internal `--sf-<block>--*` tokens and
global or framework binding attributes (`id`, `data-*`, `aria-*`, `:prop`,
`@event`, `wire:*` and the like) are never reported.

![A misspelt attribute with a Quick Fix](https://raw.githubusercontent.com/simai/ui-vscode/main/images/screenshot-diagnostics.png)

### Snippets

| Prefix | Inserts |
| --- | --- |
| `sf-field` | A labelled `sf-input` with a hint |
| `sf-checkbox-field` | A labelled `sf-checkbox` |
| `sf-button-submit` | An `sf-button` that submits its form |
| `sf-buttons` | A row of `sf-button` elements with the `flex` and `g-1/2` utilities |
| `sf-select` | An `sf-dropdown` in select mode |
| `sf-modal-dialog` | An `sf-modal` with an id, a title and a position |
| `sf-pagination-bar` | An `sf-pagination` with the current page and page size |

Snippets are built from the tags, attributes and classes in the bundled
Framework data, so they use only names that exist in the pinned release.

## Supported languages

CSS, SCSS, Sass, Less, HTML, JavaScript, TypeScript, JSX/TSX, PHP, and Vue and
Blade (with a Vue or Blade language extension installed), as used by Larena and
Bitrix templates. In markup, class attributes, `sf-` tags and `--sf-` tokens in
`style` attributes and `<style>` blocks are supported.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `sf.hover.enabled` | `true` | Show hovers for tokens, classes, tags and attributes. |
| `sf.colorSwatches.enabled` | `true` | Show colour swatches next to `--sf-` colour tokens. |
| `sf.diagnostics.enabled` | `true` | Report deprecated and likely misspelt Framework names. |
| `sf.diagnostics.unknownSeverity` | `information` | `off`, `hint`, `information`, `warning` or `error` for likely misspellings. |
| `sf.diagnostics.deprecatedSeverity` | `warning` | The same choices for deprecated tags and attributes. |
| `sf.docs.baseUrl` | empty | Base URL of the SIMAI Framework documentation site. When set, hovers link to `<baseUrl>/<registry ID>`, for example `<baseUrl>/smart.buttons`. |

## What is suggested

Suggestions come from a pinned, hash-checked snapshot of the SIMAI Framework
contract registry (release `ui-132b0863e12b`). Only entries the Framework
promotes by its written rule — ready, unblocked and safe to suggest — are
offered: 52 `sf-` components, 58 utility families and 980 design tokens in this
release. Held, blocked and unreleased entries are not suggested, but they are
still recognised, so a real Framework name is never reported as a misspelling.
Experimental components are labelled as such. The extension does not
download anything and does not read your other projects.

## Versioning

The extension stays at `0.x` while the Framework marks only part of its
components as safe to suggest. Version `1.0` follows when the main components
are covered.

## License

[MIT](LICENSE)
