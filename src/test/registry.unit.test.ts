import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import {
    completionLabel,
    detectCompletionRequest,
    matchingEntries,
} from '../completion';
import { RegistryEntry } from '../registry/types';
import { validateRegistry } from '../registry/validation';

const registry = JSON.parse(
    fs.readFileSync(
        path.resolve(process.cwd(), 'data/sf-autocomplete.json'),
        'utf8',
    ),
);

test('generated registry has the accepted adaptive contract identity', () => {
    const valid = validateRegistry(registry);
    assert.equal(valid.source.contractVersion, '1.3.0');
    assert.equal(
        valid.source.sha256,
        'b70d02d6902345e17954eafb44f24052b7478439184286bed5a8df6c69c1fe45',
    );
    assert.ok(valid.entries.length > 50);
});

test('registry validation rejects a missing desktop mode', () => {
    const broken = structuredClone(registry);
    delete broken.entries[0].modes.desktop;
    assert.throws(() => validateRegistry(broken), /desktop mode/);
});

test('registry validation rejects source hash drift', () => {
    const broken = structuredClone(registry);
    broken.source.sha256 = '0'.repeat(64);
    assert.throws(
        () => validateRegistry(broken),
        /contract identity mismatch/,
    );
});

test('default control heights retain both accepted modes', () => {
    const valid = validateRegistry(registry);
    const control = valid.entries.find(
        entry => entry.stableId === 'simai.vertical-sizing.control.height.1',
    );
    assert.equal(control?.modes.mobile.px, 36);
    assert.equal(control?.modes.desktop.px, 40);
});

test('CSS variable prefix supports fractional slash roles', () => {
    const request = detectCompletionRequest(
        'color: var(--sf-text-size-1\\/',
        'color: var(--sf-text-size-1\\/'.length,
        'css',
    );
    assert.deepEqual(request, {
        context: 'cssVariable',
        prefix: '--sf-text-size-1\\/',
        replaceLength: '--sf-text-size-1\\/'.length,
    });
    assert.ok(matchingEntries(registry.entries, request!).length > 0);
});

test('HTML class context preserves slash, colon and variant characters', () => {
    const request = detectCompletionRequest(
        '<div class="lg:hover:text-size-1/',
        '<div class="lg:hover:text-size-1/'.length,
        'html',
    );
    assert.deepEqual(request, {
        context: 'htmlClass',
        prefix: 'lg:hover:text-size-1/',
        replaceLength: 'lg:hover:text-size-1/'.length,
    });

    const fixture: RegistryEntry = {
        ...registry.entries[0],
        cssName: '--sf-fixture',
        aliases: ['lg:hover:text-size-1/2'],
        completionContexts: ['htmlClass'],
    };
    assert.equal(matchingEntries([fixture], request!).length, 1);
    assert.equal(
        completionLabel(fixture, request!),
        'lg:hover:text-size-1/2',
    );
    assert.equal(matchingEntries(registry.entries, request!).length, 0);
});
