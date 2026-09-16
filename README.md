# Storybook Markdown

[![npm version](https://img.shields.io/npm/v/storybook-addon-md)](https://www.npmjs.com/package/storybook-addon-md)
[![CI](https://github.com/ruijdacd/storybook-addon-md/actions/workflows/ci.yml/badge.svg)](https://github.com/ruijdacd/storybook-addon-md/actions/workflows/ci.yml)

Write ordinary `.md` files and browse them inside Storybook. Attach documentation to component stories or create standalone pages, with no JSX, imports, or MDX wrappers to maintain.

[Try the live example](https://storybook-addon-md.netlify.app/?path=/docs/guides-introduction--docs).

- Discover Markdown automatically, including live additions, edits, and deletions.
- Show component docs alongside existing examples and generated props.
- Bundle relative images and downloads in static builds.
- Customize native Docs styling with CSS variables or your own renderer.

## Install

We recommend [ni](https://github.com/antfu-collective/ni#readme) to install dependencies with your project's package manager. Install it first with `npm install -g @antfu/ni`, then run:

```sh
ni -D storybook-addon-md @storybook/addon-docs@10.6.0
```

Tested with **Storybook 10.6.0**, **React Vite 10.6.0**, **Vite 7.3.6**, and **React 19.2.4**. Requires Node 22.13+. Other builders and renderers are not tested.

Add the addon after `@storybook/addon-docs` in `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: [
    '@storybook/addon-docs',
    {
      name: 'storybook-addon-md',
      options: {
        patterns: ['src/**/*.md', 'docs/**/*.md', '!docs/private/**'],
      },
    },
  ],
};

export default config;
```

Keep Markdown globs in the addon’s `patterns` and story globs in Storybook’s `stories`. Add `storybook-markdown-generated/` to `.gitignore`.

## Write documentation

### Component docs

Place `Button.metadata.md` beside `Button.stories.tsx`:

```md
---
status: Stable
tags: [Actions]
---

## Overview

Use buttons to trigger actions.

## When to use

- Submit a form.
- Confirm a choice.
```

The component gets one **Docs** entry with Markdown, status and tag chips, examples, and automatic props. The name follows Storybook's `docs.defaultName`, falling back to `Docs`.

Enable Autodocs at project level in `.storybook/preview.ts`:

```ts
export default {
  tags: ['autodocs'],
};
```

Storybook 10.6.0 replaces project-level Autodocs with the attached Markdown page. Components without Markdown keep ordinary Autodocs. Use `tags: ['!autodocs']` on components that should not have automatic docs. Component-only or story-only `autodocs` tags conflict with attached MDX in this Storybook version; move the enabling tag to the preview. Native props and examples on Markdown pages do not require an `autodocs` tag.

Authored MDX keeps its title and explicit `name`. Additional attached MDX pages can use a distinct name such as `<Meta of={ButtonStories} name="Design notes" />`. An authored page using the default docs name for the same component conflicts with the addon page: keep the authored page and exclude that component's Markdown from `patterns` (or remove its association). The addon does not overwrite authored pages.

The sibling convention supports `.stories.tsx`, `.stories.ts`, `.stories.jsx`, and `.stories.js`. To associate a different file, or share a document across components, set `stories` relative to the Markdown file:

```yaml
stories:
  - ../components/Button.stories.tsx
  - ../components/Toggle.stories.tsx
```

A single path is also accepted. Explicit `stories` takes precedence over the filename convention, and referenced files must match Storybook’s story globs.

### Standalone pages

Any discovered Markdown file can stand alone. Use `title` to choose its sidebar location:

```md
---
title: Guides/Introduction
---

## Getting started

Write ordinary Markdown here.
```

Without a title, `docs/Introduction.md` appears at `Documentation/docs/Introduction`.

A leading Markdown H1 supplies the visible title, including inline formatting. Otherwise the final segment of `title` is shown. Both `# Heading` and Setext H1 syntax work; a later H1 is ordinary content. Sidebar placement and IDs always use the configured or inferred sidebar title. The original file and manifest content remain unchanged.

### Callouts

GitHub-style alerts render as labelled callouts:

```md
> [!NOTE]
> Additional context.

> [!TIP]
> Recommended approach.

> [!IMPORTANT]
> Information readers need to succeed.

> [!WARNING]
> Something that requires care.

> [!CAUTION]
> A risk or destructive consequence.
```

The marker must be the first line of a blockquote, on its own, and is case-insensitive. Callouts keep ordinary Markdown, including paragraphs, emphasis, links, lists, and code blocks, and relative links and images inside them resolve as usual. Blockquotes without a marker, unrecognized markers, and markers followed by text on the same line render as ordinary blockquotes. Custom titles and collapsible callouts are not supported. Source files and manifests keep the original syntax.

### Frontmatter

YAML frontmatter is optional. Use lowercase field names.

| Field         | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `title`       | Sidebar location for standalone pages.              |
| `stories`     | Relative story-file path or array of paths.         |
| `tags`        | Array of labels rendered as chips below the title.  |
| `description` | Optional string summary in documentation manifests. |
| `status`      | A chip with its value preserved in `data-status`.   |
| Other fields  | Preserved as metadata for custom presentation.      |

Invalid frontmatter, missing or ambiguous story references, and missing local assets produce source-specific errors.

## Configuration

| Option         | Default                        | Purpose                                                         |
| -------------- | ------------------------------ | --------------------------------------------------------------- |
| `patterns`     | Required                       | Markdown globs; prefix with `!` to exclude files.               |
| `root`         | `..`                           | Project folder, resolved from the Storybook config directory.   |
| `generatedDir` | `storybook-markdown-generated` | Disposable output folder under the working directory.           |
| `stylesheet`   | None                           | Custom stylesheet path.                                         |
| `manifests`    | `false`                        | Include original Markdown in Storybook documentation manifests. |
| `tagFields`    | `[]`                           | Additional frontmatter fields displayed as tags.                |
| `presentation` | None                           | Module exporting `Layout` and/or `MarkdownRenderer`.            |
| `links`        | None                           | Rewrite relative links to Docs pages and repository files.      |

Globs and customization paths start from your project folder (the parent of `.storybook` by default). Keep the config and local files inside that folder. Restart Storybook after changing options.

`generatedDir` must be a visible folder name using letters, digits, hyphens, or underscores. Hidden folders, nested paths, `node_modules`, and `storybook-static` are unsupported. Ignore the folder in Git; the addon manages its contents.

### Docs names and metadata tags

```ts
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  docs: { defaultName: 'Reference' },
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)', '../docs/**/*.mdx'],
  addons: [
    '@storybook/addon-docs',
    {
      name: 'storybook-addon-md',
      options: {
        patterns: ['src/**/*.md', 'docs/**/*.md'],
        tagFields: ['category', 'subcategory'],
      },
    },
  ],
};
```

`tagFields` adds string values and string array items from those fields to the existing tags. Missing fields, blank strings, and non-string values are ignored. Labels are deduplicated by exact value across documents, tags, configured fields, and status; status takes precedence and retains its original `data-status`. Metadata is not modified. Consumers can remove adapters that only copied these fields into `tags`.

### Relative links

By default every relative link is bundled as an asset, so a link to another Markdown file opens its raw source. Set `links` to rewrite relative links instead:

```ts
{
  name: 'storybook-addon-md',
  options: {
    patterns: ['src/**/*.md', 'docs/**/*.md'],
    links: {
      documents: true,
      repository: 'https://github.com/acme/design-system/blob/main',
    },
  },
}
```

| Field        | Default | Behavior                                                                                                       |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `documents`  | `true`  | Links to discovered Markdown documents become ordinary links to their Docs page in the manager.                |
| `repository` | None    | Links to other files or folders inside the project folder become `<repository>/<path relative to root>` links. |

Rendered links behave correctly without a click handler in your Layout. Docs links keep the absolute manager URL as `href`, so copying, middle-clicking, and opening in a new tab work as usual, and a plain left click asks the manager to navigate without reloading the preview. Modified clicks fall through to the browser. Absolute `http:` and `https:` links, including every `repository` link, open in a new tab with `rel="noopener noreferrer"`. Fragment links are left untouched, and explicit `target` or `rel` attributes from a custom renderer are never overridden.

Fragments and query strings are preserved. Attached documents link to their story file's Docs page using the CSF `title`; when the story file has no explicit title, the link falls back to the `story:<path>` key and will not resolve until a title is set. Images and image reference definitions remain bundled assets, and manifests keep the original Markdown. Relative links to files outside root, or to missing files, still fail the build. Without `links`, behavior is unchanged.

### Node parsing and CI checks

Use the Node-only `storybook-addon-md/node` export. It shares discovery's parser and story resolution without loading Storybook or browser code:

```ts
import { readMarkdown, parseMarkdown, resolveStoryAssociations } from 'storybook-addon-md/node';

const root = process.cwd();
const document = await readMarkdown('src/Button.metadata.md', root);

if (!document.body.includes('## When to use')) {
  throw new Error(`${document.file}: missing When to use section`);
}

const parsed = parseMarkdown('---\ntags: [Actions]\n---\n## Overview', 'virtual.md');
const stories = await resolveStoryAssociations(document.file, document.metadata, root);
```

`readMarkdown(file, root)` accepts a root-relative or absolute `.md` path and returns `{ file, original, body, metadata, stories }`. `file` and resolved `stories` are absolute paths. `original` is the complete unchanged source; `body` excludes frontmatter and normalizes BOM/CRLF just as discovery does.

`parseMarkdown(text, source)` returns `{ body, metadata }` and validates YAML, lowercase keys, title, tags, status, and story-reference value shapes. `source` labels errors. `resolveStoryAssociations(file, metadata, root)` takes parsed metadata and absolute paths, checks relative references, the four supported story extensions, file existence and root boundaries, and missing or ambiguous `.metadata.md` siblings. Explicit references take precedence. These functions throw source-specific errors; consumers can add their own template checks using `body` and metadata.

This is not a separate validation framework. These functions do not check local assets, duplicate sidebar titles, or whether stories match the consuming Storybook's globs; discovery/build still performs the relevant integration checks. Filesystem dependencies are confined to Node entry points, never the runtime export.

## Documentation manifests and MCP

Manifest support is opt-in. Set `manifests: true` in this addon's options and enable Storybook's `features.componentsManifest`:

```ts
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  features: { componentsManifest: true },
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    {
      name: 'storybook-addon-md',
      options: {
        patterns: ['src/**/*.md', 'docs/**/*.md'],
        manifests: true,
      },
    },
  ],
};
```

Use MCP's `docs-list` to find IDs, then `docs-show` with a component ID (for attached guidance) or standalone documentation ID.

For MCP access, install `@storybook/addon-mcp@10.6.0` and connect your MCP client to `http://localhost:6006/mcp`. Its Get Documentation tool is named `docs-show` in 10.6.0. Omit that addon if you only need JSON manifests. It is not a dependency of `storybook-addon-md`.

With Storybook and React Vite **10.6.0**, standalone Markdown appears in `/manifests/docs.json`, and attached Markdown appears in the component's `docs` in `/manifests/components.json`. Both development and static builds include the complete original source, including frontmatter. Development updates use the existing file watcher. Shared documents appear under each associated component; multiple documents on one page are joined in discovery order with two newlines. String `description` values supply optional summaries.

Keep this addon after `@storybook/addon-docs`. Consumers can remove custom manifest presets that supplied Markdown content after enabling this option. Unrelated MDX, Autodocs, and other manifest fields are preserved. Storybook's manifest tag filtering still applies.

This integration uses Storybook 10.6.0's experimental preset hook and inline (v0) manifests. Other Storybook versions and `features.experimentalDocgenServer` service-backed manifests are unsupported. Markdown links and assets remain as authored in manifest content. See [Storybook manifests](https://storybook.js.org/docs/ai/manifests) for the upstream feature.

## Styling

Set `stylesheet: '.storybook/markdown.css'` to override the defaults:

```css
.storybook-addon-md-page {
  --sbmd-font-size: 16px;
  --sbmd-line-height: 1.8;
  --sbmd-tag-radius: 6px;
}
```

Shared tokens cover accent, border, radius, and spacing. Element variables cover the page layout, typography, links, quotes, callouts, code, tables, images, and chips. Defaults follow Storybook’s Docs theme in light and dark mode.

See [Styling](STYLING.md) for all variables, status and callout colors, theme switching, and custom layouts or Markdown renderers. The [example stylesheet](https://github.com/ruijdacd/storybook-addon-md/blob/main/example/.storybook/markdown.css) provides a complete GitHub-inspired theme.

## Links and limitations

- Relative links and images resolve from the Markdown source and are included in static builds. Root-relative assets use Storybook’s `staticDirs`.
- Without the `links` option, links to `.md` files open the original source, not a rendered Docs page. Set `links` or use a Storybook URL such as `?path=/docs/guides-introduction--docs` for page navigation.
- Braces and JSX-like text are treated as content. Raw HTML renders as text by default.
- Set Storybook’s `parameters.options.storySort` for explicit sidebar ordering. See the [example preview](https://github.com/ruijdacd/storybook-addon-md/blob/main/example/.storybook/preview.ts).
- Multiple development Storybooks sharing one config directory are unsupported.

## Examples and contributing

Install dependencies with **Nub 0.7.5** and **Node 24.11+**:

```sh
nub install
```

Choose either example. They share stories, Markdown, and styling, with separate Storybook configurations. The MCP example sets `docs.defaultName: 'Reference'` to exercise custom docs names:

| Example     | Configuration                         | Run                            | Build                         |
| ----------- | ------------------------------------- | ------------------------------ | ----------------------------- |
| Without MCP | [Default](example/.storybook/main.ts) | `nub run storybook` (6006)     | `nub run build-storybook`     |
| With MCP    | [MCP](example/.storybook-mcp/main.ts) | `nub run storybook:mcp` (6007) | `nub run build-storybook:mcp` |

The MCP example enables `manifests: true` and `@storybook/addon-mcp`. Connect your MCP client to `http://localhost:6007/mcp`. Static builds write to `storybook-static/` and `storybook-static-mcp/`, respectively. MCP is a development dependency for the example only; normal addon usage does not require it.

Browse **Guides → Introduction**, **Guides → Callouts**, **Components → Button**, and **Components → Toggle** for standalone, attached, and shared docs with system light/dark styling.

See [Contributing](CONTRIBUTING.md) for tests and releases, or [open an issue](https://github.com/ruijdacd/storybook-addon-md/issues).
