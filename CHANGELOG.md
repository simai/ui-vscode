# Changelog

All notable changes to SIMAI Framework IntelliSense are listed here.

## [Unreleased]

### Changed

- Renamed the extension to SIMAI Framework IntelliSense and rewrote the
  README for end users; developer notes moved to CONTRIBUTING.md.
- Repinned the adaptive sizing contract to `simai.vertical-sizing@1.3.0` from
  the SIMAI Framework release `ui-a9636b60d3e3` (`simai/ui-source@1d26dd48`).
- The package now ships only the runtime files.

### Fixed

- The first completion request after opening a file no longer comes back
  empty: the extension activates when VS Code finishes starting and loads its
  registry on first use.

## [0.0.1]

- Initial preview: adaptive sizing CSS variables.
