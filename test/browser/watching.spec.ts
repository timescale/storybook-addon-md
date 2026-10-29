import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';

test('development: additions after startup appear in the sidebar, update, and disappear', async ({
  page,
  request,
}) => {
  const directory = 'example/docs/live-test';
  const file = `${directory}/Added.md`;
  const index = async () =>
    (await (await request.get('http://localhost:16006/index.json')).json()).entries;

  try {
    await page.goto('http://localhost:16006/?path=/docs/guides-introduction--docs', {
      waitUntil: 'domcontentloaded',
    });

    const preview = page.frameLocator('#storybook-preview-iframe');

    await expect(preview.getByRole('heading', { name: 'Introduction', exact: true })).toBeVisible();
    await mkdir(directory, { recursive: true });
    await writeFile(file, '---\ntitle: Guides/Added live\n---\n# Added after startup\n');

    await expect.poll(async () => Boolean((await index())['guides-added-live--docs'])).toBeTruthy();
    await expect(page.getByText('Added live', { exact: true })).toBeVisible();

    // Storybook reads its story importers when the preview loads, so a page that returns after
    // an earlier removal needs a fresh load before Storybook can render it.
    await page.reload();

    await page.getByText('Added live', { exact: true }).click();

    await expect(preview.getByRole('heading', { name: 'Added after startup' })).toBeVisible();
    await expect(preview.locator('.storybook-addon-md-page h1')).toHaveCount(1);

    await writeFile(
      file,
      '---\ntitle: Guides/Added live\n---\n## Edited without restart\n\n> [!WARNING]\n> Live callout\n',
    );

    await expect(preview.getByRole('heading', { name: 'Edited without restart' })).toBeVisible();
    await expect(preview.locator('[data-callout="warning"]')).toHaveText('WarningLive callout');
    await expect(preview.getByRole('heading', { name: 'Added live', exact: true })).toBeVisible();
    await expect(preview.locator('.storybook-addon-md-page h1')).toHaveCount(1);

    await rm(directory, { recursive: true });

    await expect.poll(async () => Boolean((await index())['guides-added-live--docs'])).toBeFalsy();
    await expect(page.getByText('Added live', { exact: true })).toHaveCount(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('development: source errors are visible and recover after correction', async ({
  page,
  request,
}) => {
  const directory = 'example/docs/error-test';
  const file = `${directory}/Recovery.md`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(file, '---\ntitle: Guides/Recovery\n---\n## Valid document\n');
    await expect
      .poll(async () =>
        Boolean(
          (await (await request.get('http://localhost:16006/index.json')).json()).entries[
            'guides-recovery--docs'
          ],
        ),
      )
      .toBeTruthy();
    await page.goto('http://localhost:16006/iframe.html?id=guides-recovery--docs&viewMode=docs', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', { name: 'Valid document' })).toBeVisible();

    for (const [content, message] of [
      ['---\ntitle: [\n---', 'invalid frontmatter'],
      ['---\nstories: ./Missing.stories.tsx\n---', 'missing story reference'],
      ['![Unavailable](missing.svg)', 'missing local asset'],
    ]) {
      await writeFile(file, content);

      await expect(
        page
          .locator('vite-error-overlay')
          .filter({ hasText: message })
          .or(page.getByRole('heading', { name: new RegExp(message) }))
          .first(),
      ).toBeVisible();

      await writeFile(file, '---\ntitle: Guides/Recovery\n---\n## Valid document\n');

      await expect(page.getByRole('heading', { name: 'Valid document' })).toBeVisible();
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /\[storybook-addon-md\]/ })).toHaveCount(0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('development: stylesheet edits update the Markdown content live', async ({ page }) => {
  const file = 'example/.storybook/markdown.css';
  const original = await readFile(file, 'utf8');

  try {
    await page.goto('http://localhost:16006/iframe.html?id=components-button--docs&viewMode=docs', {
      waitUntil: 'domcontentloaded',
    });

    const heading = page.getByRole('heading', { name: /Overview$/ });

    await expect(heading).not.toHaveCSS('border-bottom-color', 'rgb(1, 2, 3)');

    await writeFile(
      file,
      original.replace(
        '--sbmd-border-color: var(--color-control-border)',
        '--sbmd-border-color: rgb(1, 2, 3)',
      ),
    );

    await expect(heading).toHaveCSS('border-bottom-color', 'rgb(1, 2, 3)');
  } finally {
    await writeFile(file, original);
  }
});

test('development: adding and removing Markdown replaces and restores ordinary Autodocs', async ({
  page,
  request,
}) => {
  const file = 'example/docs/Autodocs-live.md';
  const id = 'examples-autodocs--docs';
  const entry = async () =>
    (await (await request.get('http://localhost:16006/index.json')).json()).entries[id];
  try {
    expect((await entry()).importPath).toContain('Autodocs.stories');
    await writeFile(
      file,
      '---\nstories: ../components/Autodocs.stories.tsx\n---\n## Added guidance\n',
    );
    await expect.poll(async () => (await entry()).importPath).toContain('page-');
    await page.goto(`http://localhost:16006/iframe.html?id=${id}&viewMode=docs`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: 'Added guidance' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Automatic example', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'variant' })).toBeVisible();
    await rm(file);
    await expect.poll(async () => (await entry()).importPath).toContain('Autodocs.stories');
    const restored = await page.context().newPage();
    await restored.goto(`http://localhost:16006/iframe.html?id=${id}&viewMode=docs`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(restored.getByRole('heading', { name: 'Autodocs', exact: true })).toBeVisible();
    await expect(
      restored.getByRole('button', { name: 'Automatic example', exact: true }),
    ).toBeVisible();
  } finally {
    await rm(file, { force: true });
  }
});

test('development: manifests refresh additions, edits, associations and deletions', async ({
  request,
}) => {
  const file = 'example/docs/Manifest-live.md';
  const source =
    '---\ntitle: Guides/Manifest live\ndescription: Live summary\n---\n# Full source\n';
  const docs = async () =>
    (await (await request.get('http://localhost:16009/manifests/docs.json')).json()).docs;
  const attached = async () =>
    (await (await request.get('http://localhost:16009/manifests/components.json')).json())
      .components['components-toggle'].docs['components-toggle--reference'];
  const shared = await readFile('example/docs/Shared.md', 'utf8');

  try {
    await writeFile(file, source);
    await expect
      .poll(async () => (await docs())['guides-manifest-live--reference']?.content)
      .toBe(source);
    expect((await docs())['guides-manifest-live--reference'].summary).toBe('Live summary');

    const edited = source.replace('Full source', 'Edited source');

    await writeFile(file, edited);
    await expect
      .poll(async () => (await docs())['guides-manifest-live--reference']?.content)
      .toBe(edited);

    const associated = '---\nstories: ../components/Toggle.stories.tsx\n---\n# Attached live\n';

    await writeFile(file, associated);
    await expect.poll(async () => (await attached()).content).toBe(`${associated}\n\n${shared}`);
    await expect
      .poll(async () => (await docs())['guides-manifest-live--reference'])
      .toBeUndefined();
    await rm(file);
    await expect.poll(async () => (await attached()).content).toBe(shared);
  } finally {
    await rm(file, { force: true });
  }
});
