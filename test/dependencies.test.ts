import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import { test } from 'vitest';

const root = path.join(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const version = async (name: string) =>
  (
    JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8')) as {
      version: string;
    }
  ).version;

// Peer ranges are what consumers install against, so they must include the versions this
// repository builds with and must not pin an exact release that blocks newer ones.
test('peer ranges are open-ended and cover the installed dependencies', async () => {
  const peers = Object.entries(manifest.peerDependencies ?? {});

  assert(peers.length > 0);

  for (const [name, range] of peers) {
    assert.equal(
      semver.valid(range),
      null,
      `${name} peer range ${range} pins an exact version; use a range so newer releases install without overrides`,
    );

    if (!(name in (manifest.devDependencies ?? {}))) continue;

    const installed = await version(name);

    assert(
      semver.satisfies(installed, range),
      `${name}@${installed} in devDependencies does not satisfy peer range ${range}`,
    );
  }
});
