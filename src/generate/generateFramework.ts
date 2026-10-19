/*
 * Builds data/sf-framework.json from the vendored SIMAI Framework snapshot in
 * contracts/framework/. With --check it only verifies that the snapshot
 * matches its pointer and that the runtime file is up to date.
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateFrameworkRegistry } from '../registry/frameworkValidation';
import { buildFramework } from './buildFramework';
import {
    FrameworkPointer,
    RawContractRegistry,
    RawPublicVariables,
    RawSmartManifest,
    sha256,
} from './frameworkInputs';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const snapshotRoot = path.join(repositoryRoot, 'contracts', 'framework');
const pointerPath = path.join(repositoryRoot, 'contracts', 'framework.pointer.json');
const sizingContractPath = path.join(repositoryRoot, 'contracts', 'adaptive-sizing.v1.json');
const outputPath = path.join(repositoryRoot, 'data', 'sf-framework.json');

const listFiles = (root: string, prefix = ''): string[] =>
    fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(item => {
        const relative = prefix ? `${prefix}/${item.name}` : item.name;
        return item.isDirectory() ? listFiles(root, relative) : [relative];
    });

const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8')) as FrameworkPointer;
const expected = Object.keys(pointer.files).sort();
const actual = listFiles(snapshotRoot).sort();
if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    const missing = expected.filter(file => !actual.includes(file));
    const extra = actual.filter(file => !expected.includes(file));
    throw new Error(
        `framework snapshot does not match its pointer; missing: ${missing.join(', ') || '-'}; `
        + `extra: ${extra.join(', ') || '-'}`,
    );
}
const contents = new Map<string, Buffer>();
for (const file of expected) {
    const content = fs.readFileSync(path.join(snapshotRoot, file));
    if (sha256(content) !== pointer.files[file].sha256) {
        throw new Error(`pinned framework file ${file} does not match its pointer hash`);
    }
    contents.set(file, content);
}
const text = (file: string): string => contents.get(file)!.toString('utf8');
const json = <T>(file: string): T => JSON.parse(text(file)) as T;
const select = <T>(pattern: RegExp, read: (file: string) => T): Record<string, T> =>
    Object.fromEntries(expected.filter(file => pattern.test(file)).map(file => [file, read(file)]));

const sizingContract = JSON.parse(fs.readFileSync(sizingContractPath, 'utf8')) as {
    modes: { desktop: { minWidthPx: number } };
};

const { registry, report } = buildFramework({
    pointer,
    registry: json<RawContractRegistry>('framework-contract-registry.json'),
    registrySha256: pointer.files['framework-contract-registry.json'].sha256,
    coreCss: text('core/core.css'),
    publicVariables: json<RawPublicVariables>('core/public-variables.v1.json'),
    utilityCss: select(/^utility\//, text),
    manifests: select(/^smart\//, file => json<RawSmartManifest>(file)),
    desktopMinWidthPx: sizingContract.modes.desktop.minWidthPx,
});
validateFrameworkRegistry(registry);

/** One array item per line: readable diffs without pretty-printing the bulk. */
function serialize(value: object): string {
    const lines = Object.entries(value).map(([key, item]) => {
        if (Array.isArray(item)) {
            const body = item.map(element => JSON.stringify(element)).join(',\n');
            return `${JSON.stringify(key)}: [\n${body}\n]`;
        }
        return `${JSON.stringify(key)}: ${JSON.stringify(item)}`;
    });
    return `{\n${lines.join(',\n')}\n}\n`;
}

const serialized = serialize(registry);
const summary = `${registry.tags.length} tags, ${registry.classes.length} classes, `
    + `${registry.tokens.length} tokens from ${pointer.releaseId}`;
if (process.argv.includes('--check')) {
    const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : null;
    if (current !== serialized) {
        process.stderr.write('data/sf-framework.json is stale\n');
        process.exitCode = 1;
    } else {
        process.stdout.write(`sf-framework parity PASS ${summary}\n`);
    }
} else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    process.stdout.write(`generated ${summary}\n`);
    if (report.skippedPublicComponents.length > 0) {
        process.stdout.write(
            `public variables skipped (component not safe to suggest): `
            + `${report.skippedPublicComponents.join(', ')}\n`,
        );
    }
    if (report.ignoredTokenMedia.length > 0) {
        process.stdout.write(
            `token values ignored under media: ${report.ignoredTokenMedia.join('; ')}\n`,
        );
    }
}
