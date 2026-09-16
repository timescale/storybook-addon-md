# CSS variable reference

Set these variables on `.storybook-addon-md-page` in the file configured by `stylesheet`. All are optional. The shared addon stylesheet supplies defaults, with text, links, borders, and inline-code backgrounds taken from the active Storybook Docs theme.

```css
.storybook-addon-md-page {
  --sbmd-font-size: 1rem;
  --sbmd-monospace-font-family: 'JetBrains Mono', monospace;
  --sbmd-accent-color: #0969da;
  --sbmd-border-color: #d1d9e0;
  --sbmd-radius: 0.375rem;
  --sbmd-block-spacing: 1.25rem;
  --sbmd-link-decoration: underline 0.0625rem;
  --sbmd-table-cell-padding: 0.75rem 1rem;
}
```

Default lengths use `rem`, preserving their original sizes at a 16px root font size and scaling with the document root font size. Set `--sbmd-monospace-font-family` to customize inline code and fenced code blocks; it defaults to Storybook’s monospace theme font.

Variables accept normal CSS values for the property they map to, including `clamp()`, `calc()`, and references to your own theme variables. Border variables accept full border shorthands, and decoration variables accept full `text-decoration` shorthands such as `underline 2px`.

## Shared tokens

Five tokens cover most of the page. Element variables fall back to them, so set the token first and reach for an element variable only where one element should differ.

| Token                    | Default                | Used by                                                                  |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `--sbmd-accent-color`    | Storybook link color   | Links and task-list checkboxes                                           |
| `--sbmd-border-color`    | Storybook border color | Heading rules, table cells, inline code, horizontal rules, quote borders |
| `--sbmd-radius`          | Unset                  | Quotes, callouts, images, and code; code alone defaults to `0.1875rem`   |
| `--sbmd-block-spacing`   | `1rem`                 | Paragraphs, lists, quotes, callouts, tables, the title, and the tag list |
| `--sbmd-heading-spacing` | `1.5rem`               | Space above headings and around horizontal rules                         |

## Element variables

| Variable                          | Applies to                                    |
| --------------------------------- | --------------------------------------------- |
| `--sbmd-font-family`              | Page and Markdown text                        |
| `--sbmd-font-size`                | Markdown text                                 |
| `--sbmd-line-height`              | Markdown text                                 |
| `--sbmd-color`                    | Page and Markdown text                        |
| `--sbmd-monospace-font-family`    | Inline code and code blocks                   |
| `--sbmd-page-max-width`           | Page `max-width`                              |
| `--sbmd-page-margin`              | Page `margin`, for example `0 auto` to center |
| `--sbmd-page-padding`             | Page `padding`                                |
| `--sbmd-page-background`          | Page `background`                             |
| `--sbmd-heading-color`            | Headings and title                            |
| `--sbmd-heading-font-family`      | Headings and title                            |
| `--sbmd-heading-weight`           | Headings and title                            |
| `--sbmd-h1-size`                  | Title and `h1`                                |
| `--sbmd-h2-size`                  | `h2`                                          |
| `--sbmd-h3-size`                  | `h3`                                          |
| `--sbmd-h4-size`                  | `h4`                                          |
| `--sbmd-h5-size`                  | `h5`                                          |
| `--sbmd-h6-size`                  | `h6`                                          |
| `--sbmd-link-color`               | Link color, defaults to the accent            |
| `--sbmd-link-decoration`          | Link `text-decoration`                        |
| `--sbmd-link-hover-decoration`    | Link `text-decoration` on hover               |
| `--sbmd-link-underline-offset`    | Link `text-underline-offset`                  |
| `--sbmd-list-item-spacing`        | Space between list items                      |
| `--sbmd-quote-border`             | Quote start border                            |
| `--sbmd-quote-padding`            | Quote padding                                 |
| `--sbmd-quote-background`         | Quote background                              |
| `--sbmd-callout-accent`           | Resolved accent of the current callout        |
| `--sbmd-callout-border`           | Callout start border                          |
| `--sbmd-callout-padding`          | Callout padding                               |
| `--sbmd-callout-background`       | Callout background                            |
| `--sbmd-callout-label-weight`     | Callout label weight                          |
| `--sbmd-callout-note-color`       | Note accent color                             |
| `--sbmd-callout-tip-color`        | Tip accent color                              |
| `--sbmd-callout-important-color`  | Important accent color                        |
| `--sbmd-callout-warning-color`    | Warning accent color                          |
| `--sbmd-callout-caution-color`    | Caution accent color                          |
| `--sbmd-code-radius`              | Inline code and code block radius             |
| `--sbmd-code-padding`             | Code block padding                            |
| `--sbmd-inline-code-padding`      | Inline code padding                           |
| `--sbmd-inline-code-background`   | Inline code background                        |
| `--sbmd-inline-code-size`         | Inline code font size                         |
| `--sbmd-table-border`             | Table cell borders                            |
| `--sbmd-table-cell-padding`       | Table cell padding                            |
| `--sbmd-table-heading-background` | Table header cell background                  |
| `--sbmd-table-stripe-background`  | Even table row background                     |
| `--sbmd-image-border`             | Image border                                  |
| `--sbmd-tag-color`                | Tag text                                      |
| `--sbmd-tag-background`           | Tag background                                |
| `--sbmd-tag-border`               | Tag border                                    |
| `--sbmd-tag-radius`               | Tag radius                                    |
| `--sbmd-tag-padding`              | Tag padding                                   |
| `--sbmd-tag-font-size`            | Tag font size                                 |

Status chips have `data-status` set to the original frontmatter value. Override `--sbmd-tag-*` on selectors such as `.storybook-addon-md-tag[data-status="stable" i]` to assign a status-specific appearance.

Links carry `data-link="docs"` for Storybook Docs pages and `data-link="external"` for absolute `http:` and `https:` URLs, so a stylesheet can mark external links or hide the distinction. Fragment links and other hrefs have no `data-link`.

Callouts are `.storybook-addon-md-callout` elements with `data-callout` set to `note`, `tip`, `important`, `warning`, or `caution`, and a `.storybook-addon-md-callout-label` paragraph. The addon sets `--sbmd-callout-accent` on each callout from its type’s accent variable, and uses it for the default border and the label color. Per-type accent variables default to Storybook theme colors chosen for the light or dark base.

Properties without a variable use ordinary CSS. Match the addon’s specificity for properties it sets, for example `.sbdocs-content .storybook-addon-md h2` for heading letter spacing or `.sbdocs-content .storybook-addon-md-tags` for the tag gap.

These styles target Markdown content and its title/chips. Story canvases, props controls, and syntax-highlighting colors still use Storybook’s theme. Custom renderers can use the shared styles when they produce matching HTML elements; custom layouts own any additional structure. Internal `--sbmd-native-*` variables carry Storybook theme values and are not customization hooks.

## Customization

The default presentation uses native Storybook Docs blocks and one shared stylesheet. Existing `parameters.docs.container` and `parameters.docs.theme` still apply.

### CSS Variables

Set `stylesheet: '.storybook/markdown.css'` in the addon options, then define your overrides:

```css
.storybook-addon-md-page {
  --sbmd-font-size: 1rem;
  --sbmd-monospace-font-family: 'JetBrains Mono', monospace;
  --sbmd-line-height: 1.8;
  --sbmd-accent-color: #0969da;
  --sbmd-radius: 0.375rem;
  --sbmd-page-max-width: 60rem;
  --sbmd-page-margin: 0 auto;
}
```

Shared tokens cover accent, borders, radius, and spacing. Element variables cover the page layout, typography, links, quotes, callouts, code, tables, images, and chips. They inherit from your theme container, and default text and link colors follow the active Docs theme. See the [reference](#css-variable-reference) for the complete list.

Use ordinary CSS for other properties. `.storybook-addon-md` wraps Markdown content, including custom renderer output; titles, props, and examples sit outside it. Other stable selectors are `.storybook-addon-md-page`, `.storybook-addon-md-title`, `.storybook-addon-md-tags`, and `.storybook-addon-md-tag`.

The stylesheet is global to the preview, so scope selectors and account for Storybook’s specificity. For example, use `.sbdocs-content .storybook-addon-md h2` when overriding its heading rules. Vite handles CSS edits, imports, and relative `url()` assets.

### Status Chips

Status chips share the tag variables. Use `data-status` to map values to your theme:

```css
.storybook-addon-md-tag[data-status='stable' i] {
  --sbmd-tag-color: light-dark(#1a7f37, #3fb950);
  --sbmd-tag-background: light-dark(#dafbe1, #12261e);
  --sbmd-tag-border: 0.0625rem solid currentColor;
}
```

The `i` flag matches both `Stable` and `stable`. The addon accepts any status; your stylesheet decides its colors. Set `color-scheme: light dark` on the theme container when using `light-dark()`.

### Callouts

Map the accent colors to your design tokens, and adjust the shared box and label styles:

```css
.storybook-addon-md-page {
  --sbmd-callout-note-color: light-dark(#0969da, #4493f8);
  --sbmd-callout-tip-color: light-dark(#1a7f37, #3fb950);
  --sbmd-callout-important-color: light-dark(#8250df, #ab7df8);
  --sbmd-callout-warning-color: light-dark(#9a6700, #d29922);
  --sbmd-callout-caution-color: light-dark(#d1242f, #f85149);
  --sbmd-callout-padding: 0.5rem 1rem;
  --sbmd-callout-label-weight: 500;
}
```

`--sbmd-callout-accent` resolves to the current callout’s color. Values that reference it must be set on the callout selector so they resolve per type. This tints every callout with its own accent:

```css
.storybook-addon-md-callout {
  --sbmd-callout-background: color-mix(in srgb, var(--sbmd-callout-accent) 8%, transparent);
  --sbmd-callout-border: 0.375rem solid var(--sbmd-callout-accent);
}
```

Use `data-callout` for anything specific to one type:

```css
.storybook-addon-md-callout[data-callout='caution'] {
  --sbmd-callout-background: light-dark(#ffebe9, #2d1214);
}
```

The label is visible text, so callouts remain distinguishable without color. The markup is static: no `role="alert"` or live region is used.

### Light and Dark Themes

Use Storybook’s standard Docs theme configuration for a fixed theme:

```ts
import { themes } from 'storybook/theming';

export default {
  parameters: { docs: { theme: themes.dark } },
};
```

For live system-preference switching, follow the example’s [Docs container] and [manager configuration]. They subscribe to preference changes so Storybook’s interface and documentation update together without reloading.

### Custom Layouts and Renderers

Set `presentation: '.storybook/markdown-presentation.tsx'` and export either or both components:

```tsx
import { DefaultLayout, DefaultMarkdownRenderer } from 'storybook-addon-md/runtime';
import type { LayoutProps, MarkdownDocument } from 'storybook-addon-md/runtime';

export function Layout(props: LayoutProps) {
  return <DefaultLayout {...props} />;
}

export function MarkdownRenderer(document: MarkdownDocument) {
  return <DefaultMarkdownRenderer {...document} />;
}
```

`MarkdownRenderer` receives `{ markdown, metadata, source, heading? }`: processed Markdown with resolved asset URLs, preserved frontmatter, and the source path relative to the project folder.

`Anchor` is the link component used by `DefaultMarkdownRenderer`. It navigates the manager for Docs links, opens external links in a new tab, sets `data-link`, and keeps explicit `target` and `rel` attributes. Reuse it in a custom renderer's `overrides` so links keep the same behavior:

```tsx
import { Markdown } from '@storybook/addon-docs/blocks';
import { Anchor } from 'storybook-addon-md/runtime';
import type { MarkdownDocument } from 'storybook-addon-md/runtime';

export function MarkdownRenderer({ markdown }: MarkdownDocument) {
  return <Markdown options={{ overrides: { a: Anchor } }}>{markdown}</Markdown>;
}
```

Callouts are rendered by `DefaultMarkdownRenderer`. A custom `MarkdownRenderer` receives them as ordinary blockquotes whose first line is the `[!NOTE]` marker, serialized as `\[!NOTE]` so that renderers treat the brackets as text. Render callouts yourself or delegate to `DefaultMarkdownRenderer`. Custom layouts are unaffected because callouts are part of `children`.

`Layout` receives `{ documents, title, attached, children, examples, heading, tagFields }`. A standalone leading H1 is extracted in the default pipeline and supplied as the rendered `heading` node; render it instead of your fallback title. The remaining Markdown is supplied through `children`, while source files and manifests stay intact. `tagFields` lists configured metadata fields for tag display. Render `children` and `examples` to keep documentation and native example/props blocks. `examples` is `null` for standalone pages. `title` contains the standalone sidebar title and is empty for attached pages; `DefaultLayout` uses Storybook’s `Title` block for those.

Customization paths are relative to the project folder and must stay inside it. Missing files produce source-specific errors. Styling and presentation are independent options.

[Docs container]: https://github.com/ruijdacd/storybook-addon-md/blob/main/example/.storybook/SystemDocsContainer.tsx
[manager configuration]: https://github.com/ruijdacd/storybook-addon-md/blob/main/example/.storybook/manager.ts
