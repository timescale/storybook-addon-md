import { test, type TestContext } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discover, parseMarkdown, resolveAssets } from '../src/content.ts';
import { readMarkdown, resolveStoryAssociations } from '../src/node.ts';
import { generate } from '../src/generator.ts';
import { stories, watchDocumentation } from '../src/preset.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sbmd-'));

  t.onTestFinished(() => rm(root, { recursive: true, force: true }));

  const config = {
    root,
    patterns: ['**/*.md', '!excluded/**'],
    output: path.join(root, '.storybook/markdown-generated'),
  };
  const put = async (name: string, content = '') => {
    const file = path.join(root, name);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);

    return file;
  };

  return { root, config, put };
}

async function until(check: () => boolean | Promise<boolean>) {
  const start = Date.now();

  while (Date.now() - start < 10000) {
    if (await check()) return;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail('Timed out waiting for file watcher');
}

test('optional lowercase frontmatter preserves custom fields and literal content', () => {
  assert.deepEqual(parseMarkdown('# Hello {value} <Button />', 'doc.md'), {
    body: '# Hello {value} <Button />',
    metadata: {},
  });

  const doc = parseMarkdown(
    '---\ncomponent: Button\nstatus: Stable\nextra:\n  nested: true\n---\nHello',
    'doc.md',
  );

  assert.deepEqual(doc.metadata, {
    component: 'Button',
    status: 'Stable',
    extra: { nested: true },
  });
  assert.equal(doc.body, 'Hello');
  assert.equal(
    parseMarkdown('\uFEFF---\r\ntitle: Hello\r\n---\r\nBody', 'doc.md').metadata.title,
    'Hello',
  );
});

test('invalid YAML and supported fields produce source-specific errors', () => {
  for (const text of [
    '---\ntitle: [\n---',
    '---\ntitle: x',
    '---\n- item\n---',
    '---\nTitle: X\n---',
    '---\ntitle: 3\n---',
    '---\nstories: []\n---',
    '---\nstories: [3]\n---',
    '---\ntitle: x\ntitle: y\n---',
    '---\nvalue: !custom foo\n---',
    '---\nnull\n---',
    '---\nvalue: .inf\n---',
  ]) {
    assert.throws(() => parseMarkdown(text, 'invalid.md'), /storybook-addon-md.*invalid.md/);
  }
});

test('discovery, exclusions, fallback titles, sibling and shared associations', async (t) => {
  const { config, put, root } = await fixture(t);

  await put('guide.md', 'Standalone');
  await put('excluded/no.md', 'Excluded');
  await put('node_modules/no.md', 'Excluded');
  await put('Button.stories.tsx');
  await put('Toggle.stories.jsx');
  await put('Button.metadata.md', 'Sibling');
  await put('shared.md', '---\nstories: [./Button.stories.tsx, ./Toggle.stories.jsx]\n---\nShared');

  const docs = await discover(config);

  assert.equal(docs.length, 3);
  assert.equal(docs.find((doc) => doc.source === 'guide.md')!.title, 'Documentation/guide');
  assert.deepEqual(docs.find((doc) => doc.source === 'Button.metadata.md')!.stories, [
    path.join(root, 'Button.stories.tsx'),
  ]);
  assert.equal(docs.find((doc) => doc.source === 'shared.md')!.stories.length, 2);

  await generate(config);

  const wrappers = (await readdir(config.output)).filter((name) => name.endsWith('.mdx'));

  assert.equal(wrappers.length, 3);

  const combined = await Promise.all(
    wrappers.map((name) => readFile(path.join(config.output, name), 'utf8')),
  );

  assert.ok(
    combined.some((text) => text.includes('document1') && text.includes('Button.stories.tsx')),
  );
});

test('missing, ambiguous, and explicit story references', async (t) => {
  const { config, put } = await fixture(t);

  await put('Button.metadata.md', 'Sibling');

  await assert.rejects(discover(config), /missing sibling story/);

  await put('Button.stories.ts');
  await put('Button.stories.tsx');

  await assert.rejects(discover(config), /ambiguous sibling/);

  await put('Button.metadata.md', '---\nstories: ./Button.stories.ts\n---\nExplicit wins');

  assert.equal((await discover(config))[0].stories.length, 1);

  await put('Button.metadata.md', '---\nstories: ./Missing.stories.ts\n---');

  await assert.rejects(discover(config), /missing story reference/);
});

test('assets include inline links, reference images, encoded paths, downloads and Markdown sources', async (t) => {
  const { root, put } = await fixture(t);
  const file = await put('docs/guide.md');

  await put('docs/image with space.svg', '<svg/>');
  await put('docs/other.md', '# Other');

  const doc = await resolveAssets(
    '![Picture][pic]\n\n[pic]: ./image%20with%20space.svg#icon\n\n[Source](other.md)\n\n[Web](https://example.com) [Root](/static/a) [Anchor](#section)\n\n`![code](missing.svg)`',
    file,
    root,
  );

  assert.equal(doc.assets.length, 2);
  assert.equal(doc.assets[0].suffix, '#icon');
  assert.match(doc.markdown, /https:\/\/example.com/);
  assert.match(doc.markdown, /missing.svg/);
  await assert.rejects(
    resolveAssets('![Missing](missing.png)', file, root),
    /guide.md: missing local asset/,
  );
  await assert.rejects(resolveAssets('[Bad](bad%XX.png)', file, root), /invalid local URL/);
});

test('callouts keep their markers, resolve nested assets, and leave the source untouched', async (t) => {
  const { root, config, put } = await fixture(t);

  await put('docs/icon.svg', '<svg/>');
  await put('docs/other.md', '# Other');

  const body =
    '> [!NOTE]\n> Additional *context* with a [link](./other.md) and ![icon](icon.svg).\n>\n> ```js\n> const value = 1;\n> ```\n\n> Plain quote.\n';
  const original = `---\ntitle: Guides/Callouts\n---\n${body}`;

  await put('docs/callouts.md', original);

  const [document] = await discover(config);

  assert.equal(document.original, original);
  assert.equal(document.body, body);
  assert.equal(
    document.markdown,
    body
      .replace('[!NOTE]', '\\[!NOTE]')
      .replace('./other.md', 'SBMDASSET0END')
      .replace('icon.svg', 'SBMDASSET1END'),
  );
  assert.deepEqual(
    document.assets.map((asset) => asset.file),
    [path.join(root, 'docs/other.md'), path.join(root, 'docs/icon.svg')],
  );
});

test('duplicate sidebar titles fail before writing output', async (t) => {
  const { config, put } = await fixture(t);

  await put('a.md', '---\ntitle: Guide/A\n---');
  await put('b.md', '---\ntitle: Guide/A\n---');

  await assert.rejects(generate(config), /duplicate or empty sidebar title/);
});

test('watcher handles new directories, edits, reassociation, deletions and error recovery', async (t) => {
  const { config, put, root } = await fixture(t);

  await generate(config);

  const errors: string[] = [];
  const watcher = watchDocumentation(config, { onError: (error) => errors.push(error.message) });

  t.onTestFinished(() => watcher.close());
  await watcher.ready;

  const pages = async () => (await readdir(config.output)).filter((name) => name.endsWith('.mdx'));
  const modules = async () =>
    (
      await Promise.all(
        (await readdir(config.output))
          .filter((name) => name.startsWith('content-'))
          .map((name) => readFile(path.join(config.output, name), 'utf8')),
      )
    ).join('\n');

  await put('new/deep/guide.md', '# First');
  await until(async () => (await pages()).length === 1);
  await put('new/deep/guide.md', '# Edited');
  await until(async () => (await modules()).includes('Edited'));
  await put('Button.stories.tsx', 'export default {};');
  await put('new/deep/guide.md', '---\nstories: ../../Button.stories.tsx\n---\nAttached');
  await until(async () => (await modules()).includes('Attached'));

  assert.match(
    await readFile(path.join(config.output, (await pages())[0]), 'utf8'),
    /of=\{ComponentStories\}/,
  );

  await put('new/deep/guide.md', '![Missing](picture.svg)');
  await until(() => errors.length > 0);

  assert.match(errors.at(-1)!, /missing local asset/);
  assert.match(await readFile(path.join(config.output, 'status.js'), 'utf8'), /throw new Error/);

  await put('new/deep/picture.svg', '<svg/>');
  await until(
    async () => (await readFile(path.join(config.output, 'status.js'), 'utf8')) === 'export {};\n',
  );
  await rm(path.join(root, 'new'), { recursive: true });
  await until(async () => (await pages()).length === 0);

  assert.equal(await modules(), '');
});

test('repeated Storybook stories hooks keep the initial glob without reparsing invalid edits', async (t) => {
  const { config, put, root } = await fixture(t);

  await put('guide.md', '# Valid');

  const options = { configDir: path.join(root, '.storybook'), patterns: config.patterns };
  const initial = await stories([], options);
  const generated = initial[0];

  assert(typeof generated !== 'string', 'Expected generated story directory');

  t.onTestFinished(() => rm(generated.directory, { recursive: true, force: true }));
  await put('guide.md', '---\ntitle: [\n---');

  assert.deepEqual(await stories([], options), initial);
});

test('negative globs take precedence over positive discovery patterns', async (t) => {
  const { config, put } = await fixture(t);

  await put('docs/public.md', '# Public');
  await put('docs/drafts/private.md', '---\ntitle: [\n---');

  const docs = await discover({
    ...config,
    patterns: ['!docs/drafts/**', 'docs/**/*.md', 'docs/drafts/**/*.md'],
  });

  assert.deepEqual(
    docs.map((document) => document.source),
    ['docs/public.md'],
  );
  await assert.rejects(
    Reflect.apply(stories, undefined, [
      [],
      {
        ...config,
        configDir: path.join(config.root, '.storybook'),
        exclude: ['docs/drafts/**'],
      },
    ]),
    /exclude has been removed; use negative globs in patterns/,
  );
});

test('stylesheet references are validated before generating pages', async (t) => {
  const { config, put, root } = await fixture(t);

  await put('guide.md', '# Guide');

  const stylesheet = path.join(root, 'markdown.css');

  await assert.rejects(generate({ ...config, stylesheet }), /missing stylesheet/);

  await put('markdown.css', '.storybook-addon-md h2 { border-bottom-style: dashed; }');
  await generate({ ...config, stylesheet });
  await rm(stylesheet);

  await assert.rejects(generate({ ...config, stylesheet }), /missing stylesheet/);
});

test('tags require a list of non-empty strings', () => {
  assert.deepEqual(parseMarkdown('---\ntags: [Guide, Stable]\n---', 'tags.md').metadata.tags, [
    'Guide',
    'Stable',
  ]);

  for (const value of ['Stable', '[3]', '[""]', 'null']) {
    assert.throws(
      () => parseMarkdown(`---\ntags: ${value}\n---`, 'tags.md'),
      /tags must be an array/,
    );
  }
});

test('generatedDir selects a visible folder and rejects watcher-incompatible paths', async (t) => {
  const { root, put } = await fixture(t);

  await put('guide.md', '# Guide');

  const options = {
    configDir: path.join(root, '.storybook'),
    patterns: ['*.md'],
    generatedDir: 'custom-doc-pages',
  };
  const result = await stories([], options);
  const generated = result[0];

  assert(typeof generated !== 'string', 'Expected generated story directory');

  t.onTestFinished(() => rm(generated.directory, { recursive: true, force: true }));

  assert.equal(path.dirname(generated.directory), path.join(process.cwd(), 'custom-doc-pages'));

  for (const generatedDir of ['.hidden', '../outside', 'nested/folder', 'node_modules', '']) {
    await assert.rejects(
      stories([], {
        ...options,
        configDir: path.join(root, generatedDir || 'empty', '.storybook'),
        generatedDir,
      }),
      /generatedDir must be/,
    );
  }
});

test('status accepts custom names and rejects empty or non-string values', () => {
  assert.equal(
    parseMarkdown('---\nstatus: In review\n---', 'status.md').metadata.status,
    'In review',
  );

  for (const value of ['null', '3', '[]', '""', '" "']) {
    assert.throws(
      () => parseMarkdown(`---\nstatus: ${value}\n---`, 'status.md'),
      /status must be a non-empty string/,
    );
  }
});

test('watcher skips unrelated and excluded changes but retains referenced dependencies', async (t) => {
  const { config, put, root } = await fixture(t);
  await put('guide.md', '![Picture](image.svg)');
  await put('image.svg', '<svg/>');

  let updates = 0;
  const watcher = watchDocumentation(config, { onUpdate: () => updates++ });
  t.onTestFinished(() => watcher.close());
  await watcher.ready;
  await new Promise((resolve) => setTimeout(resolve, 400));
  const initialUpdates = updates;

  await put('application.ts', 'export const value = 1;');
  await put('excluded/draft.md', '---\ntitle: [\n---');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(updates, initialUpdates);

  await put('image.svg', '<svg><title>Updated</title></svg>');
  await until(() => updates === initialUpdates + 1);
  await rm(path.join(root, 'guide.md'));
  await until(() => updates === initialUpdates + 2);
  await put('image.svg', '<svg/>');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(updates, initialUpdates + 2);
});

test('watcher recovers when a new metadata document gains its missing sibling', async (t) => {
  const { config, put } = await fixture(t);
  const errors: string[] = [];
  let updates = 0;
  const watcher = watchDocumentation(config, {
    onUpdate: () => updates++,
    onError: (error) => errors.push(error.message),
  });
  t.onTestFinished(() => watcher.close());
  await watcher.ready;
  await put('New.metadata.md', 'New component');
  await until(() => errors.length > 0);
  await put('New.stories.tsx', 'export default {};');
  await until(() => updates === 2);
  assert.equal(await readFile(path.join(config.output, 'status.js'), 'utf8'), 'export {};\n');
});

test('reserved asset filenames build, serve, update, and clean up through safe copies', async (t) => {
  const { build, createServer } = await import('vite');
  const { config, put, root } = await fixture(t);
  const names = [
    'image#dark.svg',
    'image%dark.svg',
    ...(process.platform === 'win32' ? [] : ['image?dark.svg']),
  ];

  await put(
    'guide.md',
    names.map((name) => `![Picture](./${encodeURIComponent(name)})`).join('\n\n'),
  );
  for (const name of names) await put(name, `<svg><title>${name}</title></svg>`);
  await generate(config);

  const content = (await readdir(config.output)).find((name) => name.startsWith('content-'))!;
  const result = await build({
    configFile: false,
    root,
    logLevel: 'silent',
    build: { write: false, lib: { entry: path.join(config.output, content), formats: ['es'] } },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const emitted = outputs
    .flatMap((result) => ('output' in result ? result.output : []))
    .filter((file) => file.type === 'asset');
  assert.equal(emitted.length, names.length);

  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
  });
  t.onTestFinished(() => server.close());
  await server.listen();
  const base = server.resolvedUrls!.local[0];
  const copies = (await readdir(config.output)).filter((name) => name.startsWith('asset-'));

  for (const copy of copies) {
    const response = await fetch(
      new URL(path.relative(root, path.join(config.output, copy)).split(path.sep).join('/'), base),
    );
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<svg><title>image/);
  }

  await put(names[0], '<svg><title>Changed</title></svg>');
  await generate(config);
  assert.ok(
    (
      await Promise.all(copies.map((name) => readFile(path.join(config.output, name), 'utf8')))
    ).some((content) => content.includes('Changed')),
  );
  await put('guide.md', 'No assets');
  await generate(config);
  assert.equal(
    (await readdir(config.output)).filter((name) => name.startsWith('asset-')).length,
    0,
  );
});

test('discovery keeps explicit files, braces, extglobs, and negative patterns', async (t) => {
  const { config, put } = await fixture(t);

  await put('docs/guide.md', '# Guide');
  await put('docs/other.md', '# Other');
  await put('docs/.hidden.md', '# Hidden');

  for (const patterns of [
    ['./docs/{guide,other}.md', '!./docs/other.md'],
    ['docs/!(other).md', '!docs/.*'],
    ['docs/*.md', '!docs/other.md'],
    ['docs/guide.md', 'docs/guide.md'],
  ]) {
    const docs = await discover({ ...config, patterns });
    assert.deepEqual(
      docs.map((document) => document.source),
      ['docs/guide.md'],
    );
  }

  assert.deepEqual(await discover({ ...config, patterns: ['docs'] }), []);
});

test('public Node API shares discovery validation and preserves source and body', async (t) => {
  const { root, config, put } = await fixture(t);
  const original =
    '---\ntitle: Guides/Sidebar\ncategory: Actions\ntags: [Stable]\nstatus: Stable\n---\n# Visible title\n\nBody';
  const file = await put('Guide.md', original);
  const parsed = await readMarkdown('Guide.md', root);
  const [discovered] = await discover(config);

  assert.equal(parsed.original, original);
  assert.equal(parsed.body, '# Visible title\n\nBody');
  assert.deepEqual(parsed.metadata, discovered.metadata);
  assert.deepEqual(parsed.stories, discovered.stories);
  assert.equal(discovered.original, original);
  assert.equal(discovered.body, parsed.body);
  assert.equal(discovered.title, 'Guides/Sidebar');
  assert.equal(discovered.heading, '# Visible title\n');
  assert.equal(discovered.markdown, 'Body\n');
  await assert.rejects(readMarkdown('Guide.mdx', root), /\.md extension/);

  for (const field of ['tags: text', 'tags: [3]', 'status: 3', 'status: ""']) {
    await put('Guide.md', `---\n${field}\n---\nBody`);
    await assert.rejects(readMarkdown(file, root), /Guide.md:/);
    await assert.rejects(discover(config), /Guide.md:/);
  }

  for (const extension of ['ts', 'tsx', 'js', 'jsx']) {
    const story = await put(`Button.stories.${extension}`);
    assert.deepEqual(
      await resolveStoryAssociations(file, { stories: `./Button.stories.${extension}` }, root),
      [story],
    );
  }
  for (const stories of ['/Button.stories.ts', './Button.ts', './Button.stories.mjs']) {
    await assert.rejects(resolveStoryAssociations(file, { stories }, root), /relative .stories/);
  }
  await assert.rejects(
    resolveStoryAssociations(file, { stories: './Missing.stories.ts' }, root),
    /missing story reference/,
  );
  const sibling = await put('Button.metadata.md', 'Body');
  await assert.rejects(readMarkdown(sibling, root), /ambiguous sibling/);
});

test('leading ATX and Setext titles are extracted only for standalone pages', async (t) => {
  const { root, put } = await fixture(t);
  const file = await put('guide.md');
  await put('icon.svg', '<svg/>');

  for (const body of ['\n# A *formatted* title\n\nBody', 'A title\n=======\n\nBody']) {
    const result = await resolveAssets(body, file, root, true);
    assert.match(result.heading!, /^# A/);
    assert.equal(result.markdown, 'Body\n');
    assert.equal((await resolveAssets(body, file, root)).heading, undefined);
  }
  for (const body of ['## Overview', 'Paragraph\n\n# Later', '> # Quoted', '```md\n# Code\n```']) {
    assert.equal((await resolveAssets(body, file, root, true)).heading, undefined);
  }
  const linked = await resolveAssets(
    '# [Title][link] ![Icon](icon.svg)\n\nBody\n\n[link]: https://example.com',
    file,
    root,
    true,
  );
  assert.match(linked.heading!, /SBMDASSET0END/);
  assert.match(linked.heading!, /https:\/\/example.com/);
});

test('generated attached pages respect configured docs names and tag fields', async (t) => {
  const { root, config, put } = await fixture(t);
  await put('Button.stories.ts');
  await put('Button.metadata.md', '# Guidance');
  for (const docsName of [undefined, 'Component Guide']) {
    await generate({ ...config, docsName, tagFields: ['category', 'subcategory'] });
    const page = (await readdir(config.output)).find((file) => file.endsWith('.mdx'))!;
    const content = await readFile(path.join(config.output, page), 'utf8');
    assert.match(content, new RegExp(`name="${docsName ?? 'Docs'}"`));
    assert.match(content, /tagFields=\{\["category","subcategory"\]\}/);
  }
  const result = await stories([], {
    configDir: path.join(root, '.storybook'),
    patterns: config.patterns,
    presets: { apply: async () => ({ defaultName: 'Reference' }) },
  });
  const generated = result[0];
  assert(typeof generated !== 'string');
  t.onTestFinished(() => rm(generated.directory, { recursive: true, force: true }));
  const page = (await readdir(generated.directory)).find((file) => file.endsWith('.mdx'))!;
  assert.match(await readFile(path.join(generated.directory, page), 'utf8'), /name="Reference"/);
});

test('tagFields rejects invalid configuration', async (t) => {
  const { root } = await fixture(t);
  for (const tagFields of ['category', [3], ['Category'], ['']]) {
    await assert.rejects(
      Reflect.apply(stories, undefined, [
        [],
        { configDir: path.join(root, '.storybook'), patterns: ['**/*.md'], tagFields },
      ]),
      /tagFields must be/,
    );
  }
});

test('links rewrite document and repository targets while images stay assets', async (t) => {
  const { config, put, root } = await fixture(t);

  await put('docs/guide.md', '---\ntitle: Guides/Getting Started\n---\n# Guide');
  await put('docs/other.md', '# Other');
  await put('docs/icon.svg', '<svg/>');
  await put('src/util.ts', 'export const value = 1;');
  await put('src/lib/index.ts', 'export {};');
  await put(
    'components/Button.stories.tsx',
    "export default { title: 'Components/Button' };\nexport const Primary = {};",
  );
  await put('components/Button.metadata.md', 'Button docs');
  await put('components/Untitled.stories.tsx', 'export default {};\nexport const Primary = {};');
  await put('components/Untitled.metadata.md', 'Untitled docs');
  await put(
    'docs/index.md',
    [
      '[Guide](./guide.md#usage)',
      '[Other](other.md?x=1)',
      '[Button](../components/Button.metadata.md)',
      '[Untitled](../components/Untitled.metadata.md)',
      '[Util](../src/util.ts#L1)',
      '[Folder](../src/lib)',
      '![Icon](./icon.svg)',
      '[Ref][icon] ![Ref][icon]',
      '[Absolute](https://example.com/a.md) [Root](/docs/guide.md)',
      '',
      '[icon]: ./icon.svg',
    ].join('\n\n'),
  );

  const repository = 'https://github.com/acme/repo/blob/main/';
  const documents = await discover({ ...config, links: { repository } });
  const index = documents.find((document) => document.source === 'docs/index.md')!;

  assert.match(index.markdown, /\[Guide\]\(\?path=\/docs\/guides-getting-started--docs#usage\)/);
  assert.match(index.markdown, /\[Other\]\(\?path=\/docs\/documentation-docs-other--docs\?x=1\)/);
  assert.match(index.markdown, /\[Button\]\(\?path=\/docs\/components-button--docs\)/);
  assert.match(
    index.markdown,
    /\[Untitled\]\(\?path=\/docs\/story:components\/Untitled\.stories\.tsx\)/,
  );
  assert.match(
    index.markdown,
    /\[Util\]\(https:\/\/github\.com\/acme\/repo\/blob\/main\/src\/util\.ts#L1\)/,
  );
  assert.match(
    index.markdown,
    /\[Folder\]\(https:\/\/github\.com\/acme\/repo\/blob\/main\/src\/lib\)/,
  );
  assert.match(index.markdown, /!\[Icon\]\(SBMDASSET0END\)/);
  assert.match(index.markdown, /\[icon\]: SBMDASSET1END/);
  assert.match(index.markdown, /https:\/\/example\.com\/a\.md/);
  assert.match(index.markdown, /\/docs\/guide\.md/);
  assert.deepEqual(
    index.assets.map((asset) => asset.file),
    [path.join(root, 'docs/icon.svg'), path.join(root, 'docs/icon.svg')],
  );
  assert.equal(index.original, await readFile(path.join(root, 'docs/index.md'), 'utf8'));

  const named = await discover({ ...config, docsName: 'Reference', links: { repository } });

  assert.match(
    named.find((document) => document.source === 'docs/index.md')!.markdown,
    /guides-getting-started--reference.*components-button--reference/s,
  );

  const onlyRepository = await discover({
    ...config,
    links: { documents: false, repository },
  });

  assert.match(
    onlyRepository.find((document) => document.source === 'docs/index.md')!.markdown,
    /\[Guide\]\(https:\/\/github\.com\/acme\/repo\/blob\/main\/docs\/guide\.md#usage\)/,
  );

  await put('docs/broken.md', '[Missing](./missing.ts)');
  await assert.rejects(
    discover({ ...config, links: { repository } }),
    /broken.md: missing link target/,
  );
  await put('docs/broken.md', '[Folder](../src/lib)');
  await assert.rejects(discover({ ...config, links: {} }), /broken.md: missing local asset/);
});

test('generated content modules emit rewritten links as plain strings', async (t) => {
  const { config, put } = await fixture(t);

  await put('docs/guide.md', '---\ntitle: Guides/Guide\n---\n# Guide');
  await put('src/util.ts', 'export {};');
  await put('docs/index.md', '[Guide](./guide.md) [Util](../src/util.ts) ![Icon](./icon.svg)');
  await put('docs/icon.svg', '<svg/>');
  await generate({ ...config, links: { repository: 'https://example.com/repo/blob/main' } });

  const modules = await Promise.all(
    (await readdir(config.output))
      .filter((name) => name.startsWith('content-'))
      .map((name) => readFile(path.join(config.output, name), 'utf8')),
  );
  const index = modules.find((content) => content.includes(`source: "docs/index.md"`))!;

  assert.ok(index, 'Expected index content module');
  assert.match(index, /\?path=\/docs\/guides-guide--docs/);
  assert.match(index, /https:\/\/example\.com\/repo\/blob\/main\/src\/util\.ts/);
  assert.equal(index.match(/^import /gm)?.length, 1);
  assert.match(index, /import asset0 from ".*icon\.svg\?url&no-inline"/);
  assert.doesNotMatch(index, /import .*(guide\.md|util\.ts)/);
});

test('links rejects malformed configuration', async (t) => {
  const { root } = await fixture(t);

  for (const links of [
    'https://example.com',
    ['https://example.com'],
    null,
    { documents: 'yes' },
    { repository: 'github.com/acme/repo' },
    { repository: '' },
    { pages: true },
  ]) {
    await assert.rejects(
      Reflect.apply(stories, undefined, [
        [],
        { configDir: path.join(root, '.storybook'), patterns: ['**/*.md'], links },
      ]),
      /links must be an object/,
    );
  }
});
