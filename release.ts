import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import semver from 'semver';

const exec = promisify(execFile);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function run(file: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec(file, args);

    return stdout;
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';

    return fail(stderr.trim() || `Command failed: ${file} ${args.join(' ')}`);
  }
}

const increments = ['major', 'minor', 'patch'] as const;
const request = process.argv[2];

if (!request) fail('Usage: ./bun release.ts <version | major | minor | patch>');

if ((await run('git', ['status', '--porcelain'])).trim()) {
  fail('Working directory is not clean. Commit, stash, or discard changes before releasing.');
}

const branch = (await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();

if (branch !== 'main') fail(`Must be on the 'main' branch to release. Currently on '${branch}'.`);

await run('git', ['fetch', 'origin', 'main']);

const behind = Number.parseInt(
  (await run('git', ['rev-list', '--count', 'main..origin/main'])).trim(),
  10,
);

if (behind > 0)
  fail(`Local 'main' is ${behind} commit(s) behind 'origin/main'. Pull before releasing.`);

const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { version?: string };
const current = packageJson.version;

if (!current || !semver.valid(current)) {
  fail(`Current version '${current ?? '(missing)'}' in package.json is not valid semver.`);
}

const next = (increments as readonly string[]).includes(request)
  ? semver.inc(current, request as (typeof increments)[number])
  : request;

if (!next || !semver.valid(next))
  fail(`Invalid version '${request}'. Expected semver like 0.10.0.`);

if (!semver.gt(next, current))
  fail(`Version ${next} is not greater than current version ${current}.`);

const tag = `v${next}`;

if ((await run('git', ['tag', '-l', tag])).trim() === tag) fail(`Tag ${tag} already exists.`);

packageJson.version = next;
await writeFile('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
await run('git', ['add', 'package.json']);
await run('git', ['commit', '-m', `release: ${tag}`]);
await run('git', ['tag', '-a', tag, '-m', tag]);
await run('git', ['push', '--atomic', '--follow-tags', 'origin', 'main']);

console.log(`Released ${tag}.`);
