# Changelog

All notable changes to SIMAI Framework IntelliSense are listed here.

## [0.1.0] - Unreleased

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
