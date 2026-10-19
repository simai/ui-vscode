/*
 * Copies a pinned SIMAI Framework snapshot from a local simai/ui clone into
 * contracts/framework/ and writes contracts/framework.pointer.json.
 *
 * Every file is read with `git show <commit>:<path>` at the commits named by
 * the release lock, never from the working tree or a moving branch head.
 * This is a maintainer tool; the extension itself never reads other
 * repositories.
 *
 * Usage:
 *   node out/generate/vendorFramework.js \
 *     --ui ../ui --release <release> [--registry-commit <sha>] [--ui-source ../ui-source]
 *
 * Without --registry-commit the tool looks up the commit in simai/ui history
 * that binds the contract registry to <release>. With --ui-source it also
 * repins the adaptive sizing contract from the simai/ui-source commit named
 * by the release lock.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
    FrameworkPointer,
    RawContractRegistry,
    ReleaseLock,
    sha256,
} from './frameworkInputs';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const snapshotRoot = path.join(repositoryRoot, 'contracts', 'framework');
const pointerPath = path.join(repositoryRoot, 'contracts', 'framework.pointer.json');
const registryPath = 'contracts/generated/framework-contract-registry.json';

function option(name: string, fallback?: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : fallback;
}
function required(name: string, fallback?: string): string {
    const value = option(name, fallback);
    if (!value) throw new Error(`--${name} is required`);
    return value;
}

const uiPath = path.resolve(required('ui', path.join(repositoryRoot, '..', 'ui')));
const releaseId = required('release');
const uiSourcePath = option('ui-source');

const gitIn = (repository: string, ...args: string[]): Buffer =>
    execFileSync('git', ['-C', repository, ...args], { maxBuffer: 64 * 1024 * 1024 });
const git = (...args: string[]): Buffer => gitIn(uiPath, ...args);
const gitText = (...args: string[]): string => git(...args).toString('utf8').trim();
const show = (commit: string, file: string): Buffer => git('show', `${commit}:${file}`);
const treeOf = (spec: string): string => gitText('rev-parse', spec);

/** The newest commit whose contract registry is bound to the release. */
function findRegistryCommit(): string {
    const commits = gitText('log', '--format=%H', 'HEAD', '--', registryPath).split('\n');
    for (const commit of commits.filter(Boolean)) {
        const registry = JSON.parse(show(commit, registryPath).toString('utf8')) as RawContractRegistry;
        if (registry.compatibility?.id === releaseId) return commit;
    }
    throw new Error(`no simai/ui commit binds the contract registry to ${releaseId}`);
}

const registryCommit = treeOf(`${option('registry-commit') ?? findRegistryCommit()}^{commit}`);
const lock = JSON.parse(
    show(registryCommit, `contracts/releases/${releaseId}.lock.json`).toString('utf8'),
) as ReleaseLock;
if (lock.compatibility_id !== releaseId) {
    throw new Error(`release lock ${releaseId} names ${lock.compatibility_id}`);
}

for (const [name, source] of Object.entries(lock.runtime_sources)) {
    if (treeOf(`${source.commit}^{tree}`) !== source.tree) {
        throw new Error(`${name}: commit ${source.commit} does not have tree ${source.tree}`);
    }
    if (treeOf(`${source.commit}:${source.runtime_path}`) !== source.runtime_tree) {
        throw new Error(`${name}: ${source.runtime_path} does not match the release runtime tree`);
    }
}
const core = lock.runtime_sources.core;
const smart = lock.runtime_sources.smart;

const registryBuffer = show(registryCommit, registryPath);
const registry = JSON.parse(registryBuffer.toString('utf8')) as RawContractRegistry;
if (registry.compatibility.id !== releaseId) {
    throw new Error(`registry at ${registryCommit} is bound to ${registry.compatibility.id}`);
}

interface PlannedFile {
    target: string;
    commit: string;
    path: string;
    content: Buffer;
}

const planned: PlannedFile[] = [];
const plan = (target: string, commit: string, file: string): void => {
    planned.push({ target, commit, path: file, content: show(commit, file) });
};

planned.push({
    target: 'framework-contract-registry.json',
    commit: registryCommit,
    path: registryPath,
    content: registryBuffer,
});
plan('core/core.css', core.commit, 'distr/core/css/core.css');
plan('core/public-variables.v1.json', core.commit, 'distr/core/contracts/public-variables.v1.json');

const safe = new Set(registry.indexes.safe_to_suggest);
for (const entry of registry.entries) {
    if (!safe.has(entry.id)) continue;
    if (entry.kind === 'utility') {
        const root = entry.runtime.asset_root;
        if (!root) throw new Error(`${entry.id} has no asset root`);
        const files = gitText('ls-tree', '-r', '--name-only', core.commit, `${root}/`)
            .split('\n')
            .filter(file => /\/([a-z0-9]+)\/css\/\1\.css$/.test(file));
        if (files.length === 0) throw new Error(`${entry.id} has no utility CSS`);
        for (const file of files) {
            plan(`utility/${file.slice('distr/utility/'.length)}`, core.commit, file);
        }
    }
    if (entry.kind === 'smart-component') {
        const ref = entry.provenance.source_refs.find(item => item.includes(':distr/smart/'));
        if (!ref) throw new Error(`${entry.id} has no smart source ref`);
        const [repoAndCommit, folder] = ref.split(':');
        const commit = repoAndCommit.split('@')[1];
        if (commit !== smart.commit) {
            throw new Error(`${entry.id} points at ${commit}, not the release smart commit`);
        }
        plan(
            `smart/${folder.slice('distr/smart/'.length)}/smart.manifest.json`,
            commit,
            `${folder}/smart.manifest.json`,
        );
    }
}

fs.rmSync(snapshotRoot, { recursive: true, force: true });
for (const file of planned) {
    const target = path.join(snapshotRoot, file.target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
}

const pointer: FrameworkPointer = {
    releaseId,
    repository: 'simai/ui',
    registryCommit,
    runtime: {
        core: { commit: core.commit, tree: core.tree, runtimeTree: core.runtime_tree },
        smart: { commit: smart.commit, tree: smart.tree, runtimeTree: smart.runtime_tree },
    },
    files: Object.fromEntries(
        planned
            .sort((left, right) => left.target.localeCompare(right.target))
            .map(file => [file.target, {
                source: `${file.commit}:${file.path}`,
                sha256: sha256(file.content),
            }]),
    ),
};
fs.writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`);
process.stdout.write(
    `vendored ${planned.length} files from simai/ui ${releaseId} (registry ${registryCommit})\n`,
);

if (uiSourcePath) {
    const source = lock.build_inputs.source;
    const sourceRepository = path.resolve(uiSourcePath);
    const sourceText = (...args: string[]): string =>
        gitIn(sourceRepository, ...args).toString('utf8').trim();
    if (sourceText('rev-parse', `${source.commit}^{tree}`) !== source.tree) {
        throw new Error(`ui-source commit ${source.commit} does not have tree ${source.tree}`);
    }
    const contractPath = 'src/core/contracts/adaptive-sizing.v1.json';
    const contract = gitIn(sourceRepository, 'show', `${source.commit}:${contractPath}`);
    const meta = (JSON.parse(contract.toString('utf8')) as {
        meta: { contractId: string; version: string };
    }).meta;
    fs.writeFileSync(path.join(repositoryRoot, 'contracts', 'adaptive-sizing.v1.json'), contract);
    const sizingPointer = {
        releaseId,
        sourceRepository: source.owner,
        sourceCommit: source.commit,
        sourceTree: source.tree,
        sourcePath: contractPath,
        contractId: meta.contractId,
        contractVersion: meta.version,
        sha256: sha256(contract),
    };
    fs.writeFileSync(
        path.join(repositoryRoot, 'contracts', 'adaptive-sizing.pointer.json'),
        `${JSON.stringify(sizingPointer, null, 2)}\n`,
    );
    process.stdout.write(
        `vendored ${meta.contractId}@${meta.version} ${sizingPointer.sha256} from ${source.owner}@${source.commit}\n`,
    );
}
