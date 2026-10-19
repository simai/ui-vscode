# Changelog

All notable changes to SIMAI Framework IntelliSense are listed here.

## [0.2.0] - Unreleased

### Added

- Diagnostics for deprecated `sf-` tags and attributes (Warning) and for likely
  misspellings of Framework tokens, tags and attributes (Information), with
  Quick Fixes to the nearest valid name. Severity is configurable with
  `sf.diagnostics.*`.
- Blade and PHP templates: class attributes, `sf-` tags and attributes, and
  tokens in `style` attributes and `<style>` blocks.
- Snippets for a form field, checkbox, submit button, button row, select and
  pagination, generated from names in the snapshot. There are no modal or
  table snippets yet because the Framework does not mark those components as
  safe to suggest.
- `sf.docs.baseUrl`: hovers link to `<baseUrl>/<registry ID>` when set.
- Marketplace screenshots, taken from VS Code with the packaged extension
  installed (`npm run screenshots`).
- CI, release and weekly Framework freshness workflows; issue templates and a
  security policy.

### Changed

- Repinned to the SIMAI Framework release `ui-3521193e0c6b` (registry
  `simai/ui@a990dd19`, runtime `simai/ui@3521193e`, sizing contract from
  `simai/ui-source@d0d01841`). The sizing contract is unchanged
  (`simai.vertical-sizing@1.3.0`), and so are the suggested names: 13 tags,
  1058 utility classes and 922 tokens. The new `--sf-button-group-radius`
  public variable is not suggested yet because Button Group is not marked
  safe to suggest.

## [0.1.0] - 2026-10-19

### Added

- Completion for SIMAI Framework `sf-` custom element tags, their attributes
  and attribute values, from the Framework component manifests.
- Completion for utility classes in `class`/`className` and as escaped
  selectors in stylesheets.
- Completion for every `--sf-` core token and the public component variables,
  with resolved light/dark and mobile/desktop values.
- Colour swatches in the completion list and in documents; the colour picker
  offers the nearest Framework colour tokens.
- Hovers for tokens, utility classes, tags and attributes with the source
  release and lifecycle. Deprecated attributes are struck through and name
  their replacement.
- Settings `sf.hover.enabled` and `sf.colorSwatches.enabled`.

### Changed

- Renamed the extension to SIMAI Framework IntelliSense and rewrote the
  README for end users; developer notes moved to CONTRIBUTING.md.
- Repinned the adaptive sizing contract to `simai.vertical-sizing@1.3.0` from
  the SIMAI Framework release `ui-a9636b60d3e3` (`simai/ui-source@1d26dd48`).
- The package now ships only the runtime files.
- A dot in markup or scripts no longer opens class suggestions; class
  selectors complete only in stylesheets.

### Fixed

- The first completion request after opening a file no longer comes back
  empty: the extension activates when VS Code finishes starting and loads its
  registry on first use.

## [0.0.1]

- Initial preview: adaptive sizing CSS variables.
