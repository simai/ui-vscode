/*
 * Records the reference pages of the documentation site in
 * contracts/docs-pages.json, which the generator builds hover links from.
 * With --check it only verifies that every recorded page is still published,
 * so a moved page fails the release and the weekly check instead of a reader.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DocsPages, pagesFromSitemap } from './docsPages';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const outputPath = path.join(repositoryRoot, 'contracts', 'docs-pages.json');
const site = 'https://ui.simai.io';

async function main(): Promise<void> {
    const response = await fetch(`${site}/sitemap.xml`);
    if (!response.ok) throw new Error(`${site}/sitemap.xml answered ${response.status}`);
    const pages = pagesFromSitemap(await response.text(), site);
    if (pages.length === 0) throw new Error(`${site}/sitemap.xml lists no reference pages`);

    if (process.argv.includes('--check')) {
        const recorded = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as DocsPages;
        const missing = recorded.pages.filter(page => !pages.includes(page));
        if (missing.length > 0) {
            throw new Error(`recorded pages are no longer published: ${missing.join(', ')}`);
        }
        process.stdout.write(`docs pages PASS ${recorded.pages.length} recorded pages are published\n`);
        return;
    }
    const value: DocsPages = { site, pages };
    fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
    process.stdout.write(`recorded ${pages.length} pages from ${site}\n`);
}

main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
