import { test, expect } from '@playwright/test';

for (const [mode, port] of [
  ['development', 16006],
  ['static', 16007],
] as const) {
  test(`${mode}: standalone, attached, shared, assets and customization render`, async ({
    page,
    request,
  }) => {
    const { entries } = await (await request.get(`http://localhost:${port}/index.json`)).json();
    const titles = [
      ...new Set(Object.values(entries).map((entry) => (entry as { title: string }).title)),
    ];
    expect(titles.indexOf('Components/Button')).toBeLessThan(titles.indexOf('Components/Toggle'));

    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));

    const open = (id: string) =>
      page.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=docs`, {
        waitUntil: 'domcontentloaded',
      });

    await open('guides-introduction--docs');

    await expect(
      page.getByRole('heading', { name: 'Ordinary Markdown, inside Storybook' }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    const chips = page.locator('.storybook-addon-md-tag');

    for (const chip of await chips.all()) {
      await expect(chip).toHaveCSS('margin', '0px');
    }

    expect(
      new Set(
        await chips.evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().top),
        ),
      ).size,
    ).toBe(1);
    await expect(page.getByRole('list', { name: 'Documentation tags' })).toHaveText(
      'GuideGetting started',
    );
    await expect(page.locator('.storybook-addon-md-tag').first()).toHaveCSS(
      'border-radius',
      '999px',
    );
    await expect(
      page.getByRole('heading', { name: 'Ordinary Markdown, inside Storybook' }),
    ).toHaveCSS('border-bottom-style', 'solid');

    await expect(page.getByRole('link', { name: 'shared guidance' })).toHaveAttribute(
      'href',
      `http://localhost:${port}/?path=/docs/components-button--docs`,
    );
    await expect(page.getByRole('link', { name: 'Button source' })).toHaveAttribute(
      'href',
      'https://github.com/ruijdacd/storybook-addon-md/blob/main/example/components/Button.tsx',
    );

    const overrides = await page.addStyleTag({
      content: `.sbdocs-wrapper .storybook-addon-md-page {
      --sbmd-h2-size: 30px;
      --sbmd-table-cell-padding: 20px;
      --sbmd-tag-radius: 14px;
    }`,
    });

    await expect(
      page.getByRole('heading', { name: 'Ordinary Markdown, inside Storybook' }),
    ).toHaveCSS('font-size', '30px');
    await expect(page.getByRole('columnheader').first()).toHaveCSS('padding', '20px');
    await expect(page.locator('.storybook-addon-md-tag').first()).toHaveCSS(
      'border-radius',
      '14px',
    );

    await overrides.evaluate((element) => element.parentNode?.removeChild(element));
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await page.setViewportSize(viewport);

    await open('guides-callouts--docs');

    const calloutTypes = ['note', 'tip', 'important', 'warning', 'caution'];
    const calloutElements = page.locator('.storybook-addon-md-callout');

    await expect(calloutElements).toHaveCount(5);
    expect(
      await calloutElements.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-callout')),
      ),
    ).toEqual(calloutTypes);
    await expect(page.locator('.storybook-addon-md-callout-label')).toHaveText([
      'Note',
      'Tip',
      'Important',
      'Warning',
      'Caution',
    ]);
    await expect(page.getByText('[!NOTE]')).toHaveCount(0);
    await expect(page.getByText('[!FOOTNOTE]')).toBeVisible();
    await expect(page.locator('blockquote')).toHaveCount(2);
    await expect(page.locator('[data-callout="important"] li')).toHaveCount(2);
    await expect(page.locator('[data-callout="warning"] pre.prismjs')).toContainText(
      'window.confirm',
    );

    await expect(
      page.locator('[data-callout="tip"]').getByRole('link', { name: 'introduction' }),
    ).toHaveAttribute('href', `http://localhost:${port}/?path=/docs/guides-introduction--docs`);

    const accents = await calloutElements.evaluateAll((elements) =>
      elements.map((element) => ({
        border: getComputedStyle(element).borderInlineStartColor,
        label: getComputedStyle(element.firstElementChild!).color,
      })),
    );

    expect(new Set(accents.map((accent) => accent.label)).size).toBe(5);
    for (const accent of accents) expect(accent.border).toBe(accent.label);

    await open('components-button--docs');

    await expect(page.getByRole('heading', { name: /Overview$/ })).toBeVisible();
    await expect(page.locator('[data-status="Stable"]')).toBeVisible();
    await expect(page.locator('[data-callout="tip"]')).toContainText(
      'TipUse the danger variant only for destructive actions.',
    );

    const unresolvedThemeVariables = await page
      .locator('.storybook-addon-md-page')
      .evaluate((element) => {
        const styles = getComputedStyle(element);
        return Array.from(styles).filter(
          (name) => name.startsWith('--sbmd-') && !styles.getPropertyValue(name).trim(),
        );
      });

    expect(unresolvedThemeVariables).toEqual([]);
    await expect(page.getByRole('list', { name: 'Documentation tags' })).toContainText('Stable');
    await expect(page.getByRole('heading', { name: /Overview$/ })).toHaveCSS(
      'border-bottom-style',
      'solid',
    );
    await expect(page.getByRole('heading', { name: /Secondary$/ })).not.toHaveCSS(
      'border-bottom-style',
      'solid',
    );
    await expect(page.getByRole('heading', { name: 'Shared interaction guidance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unavailable', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete branch', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Small', exact: true })).toHaveCSS(
      'min-height',
      '28px',
    );
    await expect(page.getByRole('button', { name: 'Large', exact: true })).toHaveCSS(
      'min-height',
      '40px',
    );
    await expect(page.getByRole('row').filter({ hasText: 'variant' })).toBeVisible();
    await expect(page.getByText('<Button variant="primary" />', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await open('components-toggle--docs');

    await expect(page.getByRole('heading', { name: 'Shared interaction guidance' })).toBeVisible();

    await expect(page.getByRole('checkbox', { name: 'Security alerts' })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Watch releases' })).toBeChecked();
    await page.getByRole('checkbox', { name: 'Enable notifications' }).check();

    await expect(page.getByRole('checkbox', { name: 'Enable notifications' })).toBeChecked();

    expect(errors).toEqual([]);
  });

  test(`${mode}: native Docs supports light and dark themes`, async ({ page }) => {
    const colors: string[] = [];
    const textColors: string[] = [];

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(
        `http://localhost:${port}/iframe.html?id=components-button--docs&viewMode=docs`,
        { waitUntil: 'domcontentloaded' },
      );

      await expect(page.getByRole('heading', { name: /Overview$/ })).toBeVisible();

      const textColor = await page
        .getByRole('heading', { name: /Overview$/ })
        .evaluate((element) => getComputedStyle(element).color);

      textColors.push(textColor);

      await expect(page.locator('[data-status="Stable"]')).toHaveCSS(
        'color',
        colorScheme === 'dark' ? 'rgb(63, 185, 80)' : 'rgb(26, 127, 55)',
      );
      await expect(page.locator('.storybook-addon-md-tag').first()).toHaveCSS(
        'color',
        colorScheme === 'dark' ? 'rgb(145, 152, 161)' : 'rgb(89, 99, 110)',
      );
      await expect(
        page.locator('[data-callout="tip"] .storybook-addon-md-callout-label'),
      ).toHaveCSS('color', colorScheme === 'dark' ? 'rgb(63, 185, 80)' : 'rgb(26, 127, 55)');
      await expect(page.locator('[data-callout="tip"]')).toHaveCSS(
        'border-left-color',
        colorScheme === 'dark' ? 'rgb(63, 185, 80)' : 'rgb(26, 127, 55)',
      );

      colors.push(
        await page
          .locator('.sbdocs-wrapper')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      );
    }

    expect(colors[0]).not.toEqual(colors[1]);
    expect(textColors[0]).not.toEqual(textColors[1]);
  });
}

for (const [mode, port] of [
  ['development', 16006],
  ['static', 16007],
] as const) {
  test(`${mode}: manager and Docs follow system theme changes without reloading`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`http://localhost:${port}/?path=/docs/components-button--docs`, {
      waitUntil: 'domcontentloaded',
    });

    const docs = page.frameLocator('#storybook-preview-iframe');
    const wrapper = docs.locator('.sbdocs-wrapper');
    const sidebar = page.locator('.sidebar-container');

    await expect(docs.getByRole('heading', { name: /Overview$/ })).toBeVisible();
    await expect(wrapper).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    const sidebarLight = await sidebar.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const managerOrigin = await page.evaluate(() => performance.timeOrigin);
    const docsOrigin = await wrapper.evaluate(() => performance.timeOrigin);

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect(wrapper).toHaveCSS('background-color', 'rgb(13, 17, 23)');
    await expect(sidebar).not.toHaveCSS('background-color', sidebarLight);
    await expect(docs.getByRole('button', { name: 'Cancel', exact: true })).toHaveCSS(
      'color',
      'rgb(240, 246, 252)',
    );

    await page.emulateMedia({ colorScheme: 'light' });

    await expect(wrapper).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(sidebar).toHaveCSS('background-color', sidebarLight);
    await expect(docs.getByRole('button', { name: 'Cancel', exact: true })).toHaveCSS(
      'color',
      'rgb(31, 35, 40)',
    );
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(managerOrigin);
    expect(await wrapper.evaluate(() => performance.timeOrigin)).toBe(docsOrigin);
  });
}

for (const [mode, port, suffix] of [
  ['development', 16006, 'docs'],
  ['static', 16007, 'docs'],
  ['development custom name', 16009, 'reference'],
  ['static custom name', 16010, 'reference'],
] as const) {
  test(`${mode}: document links open the linked Docs page in the manager`, async ({ page }) => {
    await page.goto(`http://localhost:${port}/?path=/docs/guides-introduction--${suffix}`, {
      waitUntil: 'domcontentloaded',
    });

    const preview = page.frameLocator('#storybook-preview-iframe');
    const link = preview.getByRole('link', { name: 'shared guidance' });

    await expect(link).toHaveAttribute(
      'href',
      `http://localhost:${port}/?path=/docs/components-button--${suffix}`,
    );
    await expect(link).toHaveAttribute('data-link', 'docs');
    await expect(link).not.toHaveAttribute('target');
    await link.click();

    await expect(page).toHaveURL(new RegExp(`path=/docs/components-button--${suffix}`));
    await expect(preview.getByRole('heading', { name: /Overview$/ })).toBeVisible();
    await expect(page.locator('.sidebar-container [data-selected="true"]')).toContainText(
      /Docs|Reference/,
    );
  });
}

for (const [mode, port, name, suffix] of [
  ['development', 16006, 'Docs', 'docs'],
  ['static', 16007, 'Docs', 'docs'],
  ['development custom name', 16009, 'Reference', 'reference'],
  ['static custom name', 16010, 'Reference', 'reference'],
] as const) {
  test(`${mode}: Markdown replaces Autodocs while ordinary Autodocs and authored MDX remain`, async ({
    request,
    page,
  }) => {
    const {
      entries,
    }: {
      entries: Record<
        string,
        { id: string; name: string; type: string; title: string; importPath: string }
      >;
    } = await (await request.get(`http://localhost:${port}/index.json`)).json();
    const componentDocs = Object.values(entries).filter(
      (entry) => entry.type === 'docs' && entry.title === 'Components/Button',
    ) as { id: string; name: string }[];
    expect(componentDocs.map((entry) => entry.name).sort()).toEqual([name, 'Design notes'].sort());
    expect(entries[`components-button--${suffix}`].importPath).toContain('page-');
    expect(entries[`examples-autodocs--${suffix}`].importPath).toContain('Autodocs.stories');
    expect(entries[`guides-authored--${suffix}`].importPath).toContain('Authored.mdx');
    for (const [id, heading] of [
      [`components-button--${suffix}`, /Overview$/],
      [`examples-autodocs--${suffix}`, 'Autodocs'],
      [`guides-authored--${suffix}`, 'Authored MDX'],
      ['components-button--design-notes', 'Authored design notes'],
      [`guides-heading-example--${suffix}`, 'A visible Markdown title'],
    ] as const) {
      await page.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=docs`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      if (id.startsWith('guides-heading-example'))
        await expect(page.locator('.storybook-addon-md-page h1')).toHaveCount(1);
      if (id === `components-button--${suffix}`) {
        await expect(page.getByRole('row').filter({ hasText: 'variant' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
      }
    }
  });
}
