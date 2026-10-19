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
| `contracts/framework/` | `contracts/framework.pointer.json` | `data/sf-framework.json` |

The Framework snapshot holds the contract registry, `core.css`, the public
component variables, the CSS of the utility families and the manifests of the
smart components that the registry marks as safe to suggest. Only those
entries reach `data/sf-framework.json`; blocked entries never do.

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

For the adaptive sizing contract, copy the file from the `simai/ui-source`
commit named under `build_inputs.source`, update the pointer, regenerate and
run the checks above.

For the Framework snapshot, run the vendor tool against a local `simai/ui`
clone. It reads every file with `git show` at the commits named by the release
lock and checks their trees:

```sh
npm run vendor:framework -- --ui ../ui --release <release> --registry-commit <commit>
npm run generate
npm run generate:check
```

`--registry-commit` is the `simai/ui` commit that binds the contract registry
to that release.

## Tests

```sh
npm test               # compile, lint and unit tests
npm run test:extension # extension-host tests in a downloaded VS Code
```

The extension-host runner downloads VS Code into `.vscode-test/`. Set
`VSCODE_EXECUTABLE_PATH` to use an installed build instead, or
`VSCODE_TEST_VERSION` to pin a version. Set `SF_EXTENSION_PATH` to run the
suite against another copy of the extension, for example the folder that
`code --install-extension` created from the packaged `.vsix`. The runner creates a short
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
