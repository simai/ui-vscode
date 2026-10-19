# Contributing to SIMAI Framework IntelliSense

This guide is for people who build, test or package the extension. The
end-user documentation is in [README.md](README.md).

## Setup

```sh
npm install
```

## Registries

The extension never reads other repositories at runtime. Everything it
suggests comes from pinned, hash-checked snapshots under `contracts/`, turned
into the runtime files in `data/` by generators:

| Snapshot | Pointer | Runtime file |
| --- | --- | --- |
| `contracts/adaptive-sizing.v1.json` | `contracts/adaptive-sizing.pointer.json` | `data/sf-autocomplete.json` |

Regenerate and verify parity:

```sh
npm run generate
npm run generate:check
```

`generate:check` fails when a snapshot no longer matches its pointer hash or
when a runtime file is stale.

### Repinning to a new SIMAI Framework release

Take the identity (commit and tree) from the release lock in `simai/ui`
(`contracts/releases/<release>.lock.json`), never from a moving branch head.
Copy the file from that commit, update the pointer, regenerate and run the
checks above.

## Tests

```sh
npm test               # compile, lint and unit tests
npm run test:extension # extension-host tests in a downloaded VS Code
```

The extension-host runner downloads VS Code into `.vscode-test/`. Set
`VSCODE_EXECUTABLE_PATH` to use an installed build instead, or
`VSCODE_TEST_VERSION` to pin a version. The runner creates a short
`--user-data-dir` under `/tmp`, because VS Code rejects socket paths longer
than 103 characters.

## Debugging

Open the folder in VS Code and run **Run extension** (F5).

## Packaging

```sh
npm run package:ls  # list the files that will ship
npm run package     # build the .vsix
```

`.vscodeignore` excludes everything and lists the runtime files explicitly:
compiled `out/` JavaScript (without tests, generators and source maps), the
`data/` registries, the README, CHANGELOG, LICENSE and the icon. Publishing to
the Marketplace happens only after the owner accepts a release.

## Naming

Write the product name as "SIMAI Framework". The technical prefix is `sf`.
