import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredJs = ['LocalBGCache.js', 'bgSystem.js', 'faviconCache.js', 'newtab.js'];
const expectedPermissions = ['bookmarks', 'favicon', 'storage'];
const expectedHostPermissions = ['https://icons.duckduckgo.com/*'];

function fail(message) {
    throw new Error(message);
}

async function assertFile(relativePath) {
    try {
        await access(path.join(root, relativePath), constants.R_OK);
    } catch {
        fail(`Missing required file: ${relativePath}`);
    }
}

function sameStringSet(actual = [], expected = []) {
    return actual.length === expected.length &&
        [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || '')) {
    fail(`Invalid extension version: ${manifest.version}`);
}
if (manifest.chrome_url_overrides?.newtab !== 'newtab.html') {
    fail('chrome_url_overrides.newtab must point to newtab.html');
}
if (!sameStringSet(manifest.permissions, expectedPermissions)) {
    fail(`Permission set changed: ${JSON.stringify(manifest.permissions)}`);
}
if (!sameStringSet(manifest.host_permissions, expectedHostPermissions)) {
    fail(`Host permission set changed: ${JSON.stringify(manifest.host_permissions)}`);
}

for (const file of ['manifest.json', 'newtab.html', ...requiredJs, 'icon.png']) {
    await assertFile(file);
}

for (const file of requiredJs) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
        encoding: 'utf8'
    });
    if (result.status !== 0) fail(`Syntax check failed for ${file}:\n${result.stderr}`);
}
const html = await readFile(path.join(root, 'newtab.html'), 'utf8');
const remoteCodePattern = /<(?:script|link)\b[^>]*(?:src|href)=["']https?:\/\//i;
if (remoteCodePattern.test(html)) {
    fail('Remote scripts/stylesheets are not allowed in newtab.html');
}

const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => match[1]);
if (scriptSources.length === 0) fail('No local scripts referenced by newtab.html');
for (const source of scriptSources) {
    if (/^(?:https?:|data:|blob:)/i.test(source)) fail(`Non-local script source: ${source}`);
    await assertFile(source);
}

const newtabJs = await readFile(path.join(root, 'newtab.js'), 'utf8');
for (const key of ['localJpg', 'localPng']) {
    const match = newtabJs.match(new RegExp(`${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
    if (!match) fail(`Could not find CONFIG.${key}`);
    await assertFile(match[1]);
}

const allSource = [html, newtabJs, ...await Promise.all(
    requiredJs.filter(file => file !== 'newtab.js')
        .map(file => readFile(path.join(root, file), 'utf8'))
)].join('\n');
if (/\beval\s*\(/.test(allSource)) fail('eval() is not allowed');
if ('content_security_policy' in manifest) {
    fail('Custom content_security_policy requires explicit security review');
}
if ('web_accessible_resources' in manifest) {
    fail('web_accessible_resources requires explicit security review');
}
console.log('Verification passed');
console.log(`- Manifest V${manifest.manifest_version}, extension ${manifest.version}`);
console.log(`- Permissions: ${manifest.permissions.join(', ')}`);
console.log(`- Host permissions: ${manifest.host_permissions.join(', ')}`);
console.log(`- JavaScript syntax: ${requiredJs.length} files`);
console.log(`- HTML local scripts: ${scriptSources.length}`);
console.log('- Default background assets: present');
console.log('- Remote page code: none');
