# SIMAI Framework IntelliSense

Autocomplete, hovers and colour swatches for
[SIMAI Framework](https://github.com/simai/ui) in VS Code.

## Features

### Components

Type `<sf-` in HTML, JSX/TSX or a Vue template to get the SIMAI Framework
custom elements, such as `sf-button`, `sf-input` or `sf-tabs`. Inside a tag,
the extension suggests its attributes and, for attributes with a fixed set of
values, the values themselves:

```html
<sf-button appearance="tonal" size="1/2" icon-start="check">Save</sf-button>
```

Deprecated attributes are struck through and name their replacement.

### Utility classes

Utility classes complete in `class` and `className` attributes, including
breakpoint variants such as `md:flex`. In stylesheets they complete as
escaped selectors (`.md\:flex`).

### Design tokens

Type `var(--sf-` to get every `--sf-*` token of the Framework core: colour
roles, radius, spacing, typography, control sizes, icons, opacity, z-index,
elevation and motion, plus the public variables of the components. Each
suggestion shows its resolved value:

- colour tokens show a swatch and their light and dark values;
- adaptive sizes show their mobile and desktop values.

Colour tokens in your files get inline swatches. Opening the colour picker
on one offers the nearest SIMAI Framework colour tokens.

### Hovers

Hover a token, utility class, `sf-` tag or attribute to see what it is, its
values (light/dark, mobile/desktop), the Framework release it comes from and
its lifecycle (released, experimental or deprecated).

## Supported languages

CSS, SCSS, Sass, Less, HTML, JavaScript, TypeScript, JSX/TSX and Vue (with a
Vue language extension installed).

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `sf.hover.enabled` | `true` | Show hovers for tokens, classes, tags and attributes. |
| `sf.colorSwatches.enabled` | `true` | Show colour swatches next to `--sf-` colour tokens. |

## What is suggested

Suggestions come from a pinned, hash-checked snapshot of the SIMAI Framework
contract registry (release `ui-3521193e0c6b`). Only entries the Framework marks
as safe to suggest are offered; blocked and unreleased entries are not.
Experimental components are labelled as such. The extension does not
download anything and does not read your other projects.

## License

[MIT](LICENSE)
