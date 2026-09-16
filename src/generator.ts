import type { ContentOptions, DiscoveredDocument } from './content.js';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { discover, fail, localFile, slash } from './content.js';

const attribute = (value: string) =>
  value.replace(/[&"<>\r\n]/g, (character) => `&#${character.charCodeAt(0)};`);
const id = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16);
export const pageFile = (key: string) => `page-${id(key)}.mdx`;
const specifier = (from: string, to: string) => {
  const relative = slash(path.relative(from, to));

  return relative.startsWith('.') ? relative : `./${relative}`;
};

const assetPath = (file: string, output: string) => {
  if (!/[?#%]/.test(file)) return file;

  const extension = path.extname(file);

  return path.join(
    output,
    `asset-${id(file)}${/^\.[a-z0-9]+$/i.test(extension) ? extension : '.bin'}`,
  );
};

export async function writeChanged(file: string, content: string) {
  if ((await readFile(file, 'utf8').catch(() => null)) !== content) await writeFile(file, content);
}

export function documentModule(document: DiscoveredDocument, output: string) {
  const imports = document.assets.map(
    (asset, index) =>
      `import asset${index} from ${JSON.stringify(`${specifier(output, assetPath(asset.file, output))}?url&no-inline`)};`,
  );
  const expression = (markdown: string) =>
    document.assets.reduce(
      (value, asset, index) =>
        `${value}.split(${JSON.stringify(asset.token)}).join(asset${index}.replace('?no-inline', '') + ${JSON.stringify(asset.suffix)})`,
      JSON.stringify(markdown),
    );

  return `${imports.join('\n')}\nexport default { source: ${JSON.stringify(document.source)}, metadata: JSON.parse(${JSON.stringify(JSON.stringify(document.metadata))}), markdown: ${expression(document.markdown)}, heading: ${document.heading ? expression(document.heading) : 'undefined'} };\n`;
}

export async function generate(options: ContentOptions) {
  const { output, root, presentation, stylesheet } = options;
  const documents = await discover(options);

  if (presentation) await localFile(presentation, root, presentation, 'presentation module');

  if (stylesheet) await localFile(stylesheet, root, stylesheet, 'stylesheet');

  const files = new Map<string, string>();
  const assets = new Map<string, Buffer>();
  const groups = new Map<string, { title?: string; story?: string; documents: string[] }>();
  const titles = new Set();

  for (const document of documents) {
    for (const asset of document.assets) {
      const target = assetPath(asset.file, output);

      if (target !== asset.file) assets.set(path.basename(target), await readFile(asset.file));
    }

    const moduleName = `content-${id(document.source)}.js`;

    files.set(moduleName, documentModule(document, output));

    if (!document.stories.length) {
      const sidebarId = document.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (!sidebarId || titles.has(sidebarId))
        throw fail(document.file, `duplicate or empty sidebar title: ${document.title}`);

      titles.add(sidebarId);
      groups.set(`doc:${document.source}`, { title: document.title, documents: [moduleName] });
    }

    for (const story of document.stories) {
      const key = `story:${slash(path.relative(root, story))}`;

      if (!groups.has(key)) groups.set(key, { story, documents: [] });

      groups.get(key)!.documents.push(moduleName);
    }
  }

  for (const [key, group] of groups) {
    const imports = [
      "import { Meta } from '@storybook/addon-docs/blocks';",
      "import { Documentation } from '@tigerdata/storybook-addon-md/runtime';",
      "import './status.js';",
      "import '@tigerdata/storybook-addon-md/styles.css';",
      ...group.documents.map((name, index) => `import document${index} from './${name}';`),
    ];

    if (group.story)
      imports.push(
        `import * as ComponentStories from ${JSON.stringify(specifier(output, group.story))};`,
      );

    if (presentation)
      imports.push(
        `import * as presentation from ${JSON.stringify(specifier(output, presentation))};`,
      );

    if (stylesheet) imports.push(`import ${JSON.stringify(specifier(output, stylesheet))};`);

    const meta = group.story
      ? `<Meta of={ComponentStories} name="${attribute(options.docsName ?? 'Docs')}" />`
      : `<Meta title="${attribute(group.title!)}" />`;

    files.set(
      pageFile(key),
      `${imports.join('\n')}\n\n${meta}\n\n<Documentation documents={[${group.documents.map((_, index) => `document${index}`).join(', ')}]} attached={${Boolean(group.story)}} title={${JSON.stringify(group.title ?? '')}} tagFields={${JSON.stringify(options.tagFields ?? [])}}${presentation ? ' presentation={presentation}' : ''} />\n`,
    );
  }

  files.set('status.js', 'export {};\n');
  await mkdir(output, { recursive: true });

  for (const [name, content] of assets) {
    const file = path.join(output, name);
    const previous = await readFile(file).catch(() => null);

    if (!previous?.equals(content)) await writeFile(file, content);
  }

  for (const [name, content] of files) await writeChanged(path.join(output, name), content);

  for (const name of await readdir(output)) {
    if (
      /^(?:page-[a-f0-9]+\.mdx|content-[a-f0-9]+\.js|asset-[a-f0-9]+\.[a-z0-9]+)$/.test(name) &&
      !files.has(name) &&
      !assets.has(name)
    )
      await unlink(path.join(output, name));
  }

  return documents;
}
