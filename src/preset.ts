import type { PresetPropertyFn, StorybookConfigRaw } from 'storybook/internal/types';
import type { UserConfig, ViteDevServer } from 'vite';
import type { MarkdownOptions } from './index.js';
import type { ContentOptions, DiscoveredDocument } from './content.js';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { watch } from 'chokidar';
import picomatch from 'picomatch';
import { updateManifests } from './manifest.js';
import { generate, writeChanged } from './generator.js';
import { fail, slash } from './content.js';

type PresetOptions = MarkdownOptions & {
  configDir: string;
  presets?: { apply: (name: 'docs') => Promise<{ defaultName?: string }> };
};

type StoryEntry = string | { directory: string; files?: string; titlePrefix?: string };

const sessions = new Map<
  string,
  { config: ContentOptions; ready: Promise<DiscoveredDocument[]> }
>();

function settings(options: PresetOptions) {
  const configDir = path.resolve(options.configDir);
  const root = path.resolve(configDir, options.root ?? '..');
  const generatedDir = options.generatedDir ?? 'storybook-markdown-generated';

  if (
    options.tagFields !== undefined &&
    (!Array.isArray(options.tagFields) ||
      options.tagFields.some(
        (field) => typeof field !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(field),
      ))
  ) {
    throw fail(configDir, 'tagFields must be an array of lowercase frontmatter field names');
  }

  const { links } = options;

  if (
    links !== undefined &&
    (typeof links !== 'object' ||
      links === null ||
      Array.isArray(links) ||
      Object.keys(links).some((key) => !['documents', 'repository'].includes(key)) ||
      (links.documents !== undefined && typeof links.documents !== 'boolean') ||
      (links.repository !== undefined &&
        (typeof links.repository !== 'string' || !/^https?:\/\/\S+$/.test(links.repository))))
  ) {
    throw fail(
      configDir,
      'links must be an object with an optional documents boolean and an optional repository URL',
    );
  }

  if ('exclude' in options) {
    throw fail(
      configDir,
      'exclude has been removed; use negative globs in patterns, such as !docs/private/**',
    );
  }

  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(generatedDir) ||
    ['node_modules', 'storybook-static'].includes(generatedDir)
  ) {
    throw fail(
      configDir,
      'generatedDir must be a visible folder name containing only letters, digits, hyphens or underscores',
    );
  }

  return {
    root,
    output: path.join(
      process.cwd(),
      generatedDir,
      createHash('sha256').update(configDir).digest('hex').slice(0, 12),
    ),
    patterns: options.patterns,
    tagFields: options.tagFields,
    stylesheet: options.stylesheet ? path.resolve(root, options.stylesheet) : undefined,
    presentation: options.presentation ? path.resolve(root, options.presentation) : undefined,
    links: links
      ? { documents: links.documents ?? true, repository: links.repository?.replace(/\/+$/, '') }
      : undefined,
  };
}

export async function stories(existing: StoryEntry[] = [], options: PresetOptions) {
  const key = path.resolve(options.configDir);

  if (!sessions.has(key)) {
    const docs = await options.presets?.apply('docs');
    const config = { ...settings(options), docsName: docs?.defaultName ?? 'Docs' };

    sessions.set(key, { config, ready: generate(config) });
  }

  const session = sessions.get(key)!;

  await session.ready;

  return [...existing, { directory: session.config.output, files: '*.mdx' }];
}

export function watchDocumentation(
  config: ContentOptions,
  {
    onError = () => {},
    onUpdate = () => {},
  }: {
    onError?: (error: Error) => void;
    onUpdate?: (documents: DiscoveredDocument[]) => void;
  } = {},
) {
  const isNegative = (pattern: string) => pattern.startsWith('!') && !pattern.startsWith('!(');
  const positive = config.patterns.filter((pattern) => !isNegative(pattern));
  const negative = config.patterns
    .filter((pattern) => isNegative(pattern) && !isNegative(pattern.slice(1)))
    .map((pattern) => pattern.slice(1));
  const include = picomatch(
    positive.map((pattern) => path.posix.normalize(pattern)),
    { posix: true },
  );
  const exclude = picomatch(
    negative.map((pattern) => path.posix.normalize(pattern)),
    { posix: true },
  );
  const dependencies = new Set<string>();
  const configuredDependencies = [config.presentation, config.stylesheet].filter(
    (file): file is string => Boolean(file),
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let queue = Promise.resolve();
  const refresh = () => {
    queue = queue.then(async () => {
      if (closed) return;

      try {
        const documents = await generate(config);

        dependencies.clear();
        for (const file of configuredDependencies) dependencies.add(file);
        for (const document of documents) {
          for (const file of document.stories) dependencies.add(file);
          for (const asset of document.assets) dependencies.add(asset.file);
          if (document.file.endsWith('.metadata.md') && !('stories' in document.metadata)) {
            for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
              dependencies.add(document.file.replace(/\.metadata\.md$/, `.stories.${extension}`));
            }
          }
        }
        onUpdate(documents);
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));

        if ('dependencies' in error && Array.isArray(error.dependencies)) {
          for (const file of error.dependencies)
            if (typeof file === 'string') dependencies.add(file);
        }

        if ('dependency' in error && typeof error.dependency === 'string')
          dependencies.add(error.dependency);

        await writeChanged(
          path.join(config.output, 'status.js'),
          `throw new Error(${JSON.stringify(error.message)});\n`,
        );
        onError(error);
      }
    });

    return queue;
  };
  const watcher = watch(config.root, {
    ignoreInitial: true,
    ignored: (file) =>
      file === config.output ||
      /(?:^|[/\\])(?:node_modules|\.git|storybook-static)(?:[/\\]|$)/.test(file),
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
  });

  watcher.on('all', (event, file) => {
    if (event === 'addDir' || event === 'unlinkDir') return;

    const relative = slash(path.relative(config.root, file));
    const markdown = file.endsWith('.md') && include(relative) && !exclude(relative);

    if (!markdown && !dependencies.has(file) && !configuredDependencies.includes(file)) return;

    clearTimeout(timer);
    timer = setTimeout(refresh, 80);
  });
  watcher.on('error', (error) =>
    onError(error instanceof Error ? error : new Error(String(error))),
  );

  const ready = new Promise<void>((resolve) =>
    watcher.once('ready', () => refresh().then(resolve)),
  );

  return {
    ready,
    async close() {
      closed = true;
      clearTimeout(timer);
      await watcher.close();
      await queue;
    },
  };
}

export async function viteFinal(config: UserConfig, options: PresetOptions): Promise<UserConfig> {
  const session = sessions.get(path.resolve(options.configDir))?.config ?? settings(options);

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      {
        name: 'storybook-addon-md',
        configureServer(server: ViteDevServer) {
          const watcher = watchDocumentation(session, {
            onUpdate(documents) {
              const current = sessions.get(path.resolve(options.configDir));

              if (current) current.ready = Promise.resolve(documents);
            },
            onError(error) {
              server.config.logger.error(error.message);
              server.ws.send({ type: 'error', err: { message: error.message, stack: '' } });
            },
          });

          server.httpServer?.once('close', () => void watcher.close());
        },
      },
    ],
  };
}

export function webpackFinal() {
  throw fail('builder', 'only @storybook/react-vite 10.6.0 with Vite 7 is supported');
}

export const experimental_manifests = (async (
  manifests: NonNullable<StorybookConfigRaw['experimental_manifests']> = {},
  options: Pick<PresetOptions, 'configDir' | 'manifests'>,
) => {
  const session = sessions.get(path.resolve(options.configDir));

  if (!options.manifests || !session) return manifests;

  return updateManifests(manifests, await session.ready, session.config);
}) satisfies PresetPropertyFn<'experimental_manifests'>;
