import { mkdtemp, mkdir, readdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify, stripVTControlCharacters } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chromium, expect, type Browser } from '@playwright/test';

const exec = promisify(execFile);
const project = await mkdtemp(path.join(os.tmpdir(), 'storybook-md-consumer-'));
let server: ChildProcess | undefined;
let browser: Browser | undefined;
let output = '';
const bun = path.resolve('bun');
const run = async (args: string[], cwd: string) => {
  const label = `Consumer: bun ${args.join(' ')}`;
  console.time(label);
  try {
    return await exec(bun, args, { cwd, maxBuffer: 5 * 1024 * 1024 });
  } finally {
    console.timeEnd(label);
  }
};

try {
  await run(['pm', 'pack', '--quiet', '--destination', project], process.cwd());
  const [filename] = (await readdir(project)).filter((name) => name.endsWith('.tgz'));

  await cp('example', project, {
    recursive: true,
    filter: (source) => !source.includes('markdown-generated'),
  });
  await writeFile(
    path.join(project, 'package.json'),
    JSON.stringify({
      name: 'markdown-addon-consumer',
      private: true,
      type: 'module',
      devDependencies: {
        '@tigerdata/storybook-addon-md': `file:${filename}`,
        '@storybook/addon-docs': '10.6.0',
        '@storybook/addon-mcp': '10.6.0',
        '@storybook/react-vite': '10.6.0',
        storybook: '10.6.0',
        react: '19.2.4',
        'react-dom': '19.2.4',
        vite: '7.3.6',
        typescript: '5.9.3',
        '@types/react': '^19.2.0',
        tailwindcss: '^4',
        '@tailwindcss/vite': '^4',
        clsx: '^2.1.1',
        'class-variance-authority': '^0.7.1',
      },
    }),
  );
  await writeFile(
    path.join(project, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
      },
      include: ['components', '.storybook', '.storybook-mcp'],
    }),
  );
  await mkdir(path.join(project, 'docs/assets'), { recursive: true });
  await writeFile(
    path.join(project, 'docs/assets/button.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>',
  );
  await writeFile(
    path.join(project, 'docs/Asset-check.md'),
    '> [!NOTE]\n> ![Asset check](./assets/button.svg)\n',
  );

  const mainFile = path.join(project, '.storybook/main.ts');

  await run(['install'], project);
  await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { parseMarkdown, readMarkdown, resolveStoryAssociations } from '@tigerdata/storybook-addon-md/node';
    const document = await readMarkdown('components/Button.metadata.md', process.cwd());
    assert.equal(document.original, await readFile(document.file, 'utf8'));
    assert.equal(document.metadata.status, 'Stable');
    assert.equal(document.stories.length, 1);
    assert.deepEqual(await resolveStoryAssociations(document.file, document.metadata, process.cwd()), document.stories);
    assert.deepEqual(parseMarkdown(document.original, document.file).metadata, document.metadata);
    assert.throws(() => parseMarkdown('---\\ntags: invalid\\n---', 'invalid.md'), /tags must be/);
  `,
    ],
    { cwd: project },
  );
  await run(['x', 'storybook', 'build', '-c', '.storybook-mcp', '--disable-telemetry'], project);

  const { entries } = JSON.parse(
    await readFile(path.join(project, 'storybook-static/index.json'), 'utf8'),
  );

  for (const id of [
    'guides-introduction--reference',
    'components-button--reference',
    'components-toggle--reference',
  ]) {
    assert.equal(entries[id]?.type, 'docs', id);
  }

  const staticDocs = JSON.parse(
    await readFile(path.join(project, 'storybook-static/manifests/docs.json'), 'utf8'),
  );
  const staticComponents = JSON.parse(
    await readFile(path.join(project, 'storybook-static/manifests/components.json'), 'utf8'),
  );
  const shared = await readFile(path.join(project, 'docs/Shared.md'), 'utf8');

  assert.equal(
    staticDocs.docs['guides-introduction--reference'].content,
    await readFile(path.join(project, 'docs/Introduction.md'), 'utf8'),
  );
  assert.equal(
    staticComponents.components['components-button'].docs['components-button--reference'].content,
    `${await readFile(path.join(project, 'components/Button.metadata.md'), 'utf8')}\n\n${shared}`,
  );

  const builtAssets = await readdir(path.join(project, 'storybook-static/assets'));

  assert(builtAssets.some((name) => /^button-.*\.svg$/.test(name)));

  await rm(path.join(project, 'docs/assets/button.svg'));

  await assert.rejects(
    run(['x', 'storybook', 'build', '-c', '.storybook-mcp', '--disable-telemetry'], project),
    (error) => {
      assert(error instanceof Error);
      assert.match(
        stripVTControlCharacters(
          ('stdout' in error ? String(error.stdout) : '') +
            ('stderr' in error ? String(error.stderr) : ''),
        ),
        /missing local[\s│]+asset/,
      );

      return true;
    },
  );

  await writeFile(
    mainFile,
    (await readFile(mainFile, 'utf8')).replace(
      "['docs/**/*.md', 'components/**/*.md', '!docs/drafts/**']",
      "['empty-docs/**/*.md']",
    ),
  );
  await rm(path.join(project, 'example-markdown-generated'), { recursive: true });

  const storybookPackage = JSON.parse(
    await readFile(path.join(project, 'node_modules/storybook/package.json'), 'utf8'),
  );

  server = spawn(
    process.execPath,
    [
      path.join(project, 'node_modules/storybook', storybookPackage.bin),
      'dev',
      '-c',
      '.storybook-mcp',
      '--ci',
      '--no-open',
      '--disable-telemetry',
      '--exact-port',
      '-p',
      '16008',
    ],
    { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stdout!.on('data', (data) => {
    output += data;
  });
  server.stderr!.on('data', (data) => {
    output += data;
  });
  await expect
    .poll(
      async () => {
        if (server?.exitCode !== null) throw new Error(output);

        return fetch('http://localhost:16008/index.json').then(
          (response) => response.ok,
          () => false,
        );
      },
      { timeout: 120000 },
    )
    .toBeTruthy();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });

  const page = await browser.newPage();

  page.on('pageerror', (error) => console.error(error.message));
  await page.goto('http://localhost:16008/?path=/story/components-button--primary');

  await expect(
    page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('button', { name: 'Continue', exact: true }),
  ).toBeVisible({ timeout: 15000 });

  await page.goto('http://localhost:16008/?path=/docs/guides-authored--reference');
  await expect(
    page.frameLocator('#storybook-preview-iframe').getByRole('heading', { name: 'Authored MDX' }),
  ).toBeVisible({ timeout: 15000 });

  await mkdir(path.join(project, 'empty-docs'));
  await writeFile(
    path.join(project, 'empty-docs/First.md'),
    '---\ntitle: Guides/First\n---\n# First document after startup\n',
  );
  await expect
    .poll(
      async () =>
        (await (await fetch('http://localhost:16008/index.json')).json()).entries[
          'guides-first--reference'
        ],
    )
    .toBeTruthy();

  await expect(page.getByRole('link', { name: 'First', exact: true })).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole('link', { name: 'First', exact: true }).click();

  await expect(
    page
      .frameLocator('#storybook-preview-iframe')
      .getByRole('heading', { name: 'First document after startup' }),
  ).toBeVisible({ timeout: 15000 });

  const manifestUrl = 'http://localhost:16008/manifests/docs.json';
  const original = await readFile(path.join(project, 'empty-docs/First.md'), 'utf8');

  await expect
    .poll(
      async () =>
        (await (await fetch(manifestUrl)).json()).docs['guides-first--reference']?.content,
    )
    .toBe(original);

  const mcpResponse = await fetch('http://localhost:16008/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'docs-show', arguments: { id: 'guides-first--reference' } },
    }),
  });
  const mcpText = await mcpResponse.text();

  assert.equal(mcpResponse.status, 200, mcpText);
  assert(mcpText.includes(JSON.stringify(original).slice(1, -1)), mcpText);

  const associated = '---\nstories: ../components/Button.stories.tsx\n---\n# Attached MCP source\n';
  await writeFile(path.join(project, 'empty-docs/First.md'), associated);
  await expect
    .poll(
      async () =>
        (await (await fetch('http://localhost:16008/manifests/components.json')).json()).components[
          'components-button'
        ].docs['components-button--reference']?.content,
    )
    .toBe(associated);
  const attachedResponse = await fetch('http://localhost:16008/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'docs-show', arguments: { id: 'components-button' } },
    }),
  });
  const attachedText = await attachedResponse.text();
  assert.equal(attachedResponse.status, 200, attachedText);
  assert(attachedText.includes(JSON.stringify(associated).slice(1, -1)), attachedText);

  console.log(
    'Packed consumer: public Node API, static build, missing-asset failure, live manifests, real MCP documentation, and first Markdown added after startup passed.',
  );
} catch (error) {
  console.error(error, output);
  console.error(
    'Generated files',
    await readdir(path.join(project, 'example-markdown-generated')).catch(() => []),
  );
  console.error(
    'Index',
    await fetch('http://localhost:16008/index.json')
      .then((response) => response.text())
      .catch(() => 'unavailable'),
  );

  throw error;
} finally {
  await browser?.close();

  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');

    server.kill();
    await exited;
  }

  await rm(project, { recursive: true, force: true });
}
