/*
 * Asserts that `vsce ls` lists only runtime files and all of them.
 * Usage: npx vsce ls | node out/generate/checkPackage.js
 */
import * as fs from 'fs';

const allowed = [
    /^package\.json$/,
    /^README\.md$/,
    /^CHANGELOG\.md$/,
    /^LICENSE$/,
    /^images\/icon\.png$/,
    /^data\/[a-z0-9-]+\.json$/,
    /^snippets\/[a-z0-9-]+\.json$/,
    /^out\/(?!test\/|generate\/)[A-Za-z0-9/_-]+\.js$/,
];
const required = [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'images/icon.png',
    'data/sf-autocomplete.json',
    'data/sf-framework.json',
    'out/extension.js',
];

const files = fs.readFileSync(0, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
const unexpected = files.filter(file => !allowed.some(pattern => pattern.test(file)));
const missing = required.filter(file => !files.includes(file));
if (unexpected.length > 0 || missing.length > 0) {
    process.stderr.write(
        `package check FAIL\nunexpected: ${unexpected.join(', ') || '-'}\nmissing: ${missing.join(', ') || '-'}\n`,
    );
    process.exit(1);
}
process.stdout.write(`package check PASS: ${files.length} runtime files\n`);
