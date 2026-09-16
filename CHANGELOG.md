# storybook-addon-md

## 0.9.0

### Minor Changes

- 990c4b9: Rendered links now behave correctly on their own. Docs links keep the absolute manager URL and navigate through the Storybook channel on a plain click, so the preview no longer reloads; modified clicks and non-primary buttons fall through to the browser. External links open in a new tab with `rel="noopener noreferrer"`, both kinds carry a `data-link` attribute, and explicit `target` or `rel` attributes are preserved. `Anchor` is exported from `storybook-addon-md/runtime` for custom renderers.

  Docs links no longer set `target="_top"`. Stylesheets or tests that relied on that attribute should target `[data-link="docs"]` instead.

## 0.8.0

### Minor Changes

- 298284c: Add an opt-in `links` option that rewrites relative Markdown links instead of bundling their targets as assets.

  - `links.documents` (default `true` when `links` is set) turns links to other discovered documents into ordinary links to their Docs page in the Storybook manager.
  - `links.repository` turns links to other files or folders inside root into `<repository>/<relative path>` links, so source files are no longer copied into the bundle and folder links no longer fail discovery.

  Images, image reference definitions, manifests, and the default behavior without `links` are unchanged.

## 0.7.0

### Minor Changes

- 91cc4a7: Add back focused styling hooks for the page, links, quotes, callouts, tables, and images, built on two new shared tokens.

  **New shared tokens**

  - `--sbmd-accent-color` colors links and task-list checkboxes. `--sbmd-link-color` now defaults to it.
  - `--sbmd-radius` rounds quotes, callouts, images, and code. It is unset by default, so code keeps its `0.1875rem` radius and other elements stay square until you set it.

  **New element variables**

  | Area     | Variables                                                                                                                        |
  | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | Page     | `--sbmd-page-max-width`, `--sbmd-page-margin`, `--sbmd-page-padding`, `--sbmd-page-background`                                   |
  | Links    | `--sbmd-link-hover-decoration`, `--sbmd-link-underline-offset`. `--sbmd-link-decoration` accepts shorthands like `underline 1px` |
  | Quotes   | `--sbmd-quote-background`                                                                                                        |
  | Callouts | `--sbmd-callout-accent`, `--sbmd-callout-border`, `--sbmd-callout-background`                                                    |
  | Tables   | `--sbmd-table-border`, `--sbmd-table-heading-background`                                                                         |
  | Images   | `--sbmd-image-border`                                                                                                            |

  **Callout accents**

  Each callout now exposes its resolved color as `--sbmd-callout-accent`. Reference it from a `.storybook-addon-md-callout` rule to derive tinted backgrounds or borders for every type at once:

  ```css
  .storybook-addon-md-callout {
    --sbmd-callout-background: color-mix(in srgb, var(--sbmd-callout-accent) 8%, transparent);
  }
  ```

  **Behavior change**

  `--sbmd-quote-border` no longer applies to callouts. Set `--sbmd-callout-border` instead; its default is `0.25rem solid var(--sbmd-callout-accent)`.

## 0.6.0

### Minor Changes

- 589ccad: Consolidate the CSS variables into a smaller set built around shared tokens. Every remaining variable keeps its name and meaning.

  **New shared tokens**

  | Variable                 | Replaces                                                                                                                                      |
  | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
  | `--sbmd-border-color`    | `--sbmd-h2-border`, `--sbmd-table-border`, `--sbmd-inline-code-border`, `--sbmd-rule-color`, and the color of the default quote border        |
  | `--sbmd-block-spacing`   | `--sbmd-paragraph-spacing`, `--sbmd-quote-margin`, `--sbmd-callout-margin`, `--sbmd-table-margin`, `--sbmd-title-margin`, `--sbmd-tag-margin` |
  | `--sbmd-heading-spacing` | `--sbmd-h2-margin`, `--sbmd-h3-margin`, `--sbmd-rule-margin`                                                                                  |

  **Widened variables**

  | Variable              | Now also controls                                                                                          |
  | --------------------- | ---------------------------------------------------------------------------------------------------------- |
  | `--sbmd-h1-size`      | The page title, replacing `--sbmd-title-size`                                                              |
  | `--sbmd-code-radius`  | Inline code, replacing `--sbmd-inline-code-radius`                                                         |
  | `--sbmd-quote-border` | The width and style of callout borders, replacing `--sbmd-callout-border`. The accent color still applies. |

  **Removed without replacement**

  The addon no longer sets these properties, so ordinary CSS at any specificity applies. For example, `.storybook-addon-md img { border-radius: 0.5rem }`.

  - Page: `--sbmd-background`, `--sbmd-max-width`, `--sbmd-page-padding`, `--sbmd-page-border`, `--sbmd-page-radius`. Style `.storybook-addon-md-page`.
  - Images: `--sbmd-image-border`, `--sbmd-image-margin`, `--sbmd-image-radius`.
  - Quotes and callouts: `--sbmd-quote-background`, `--sbmd-quote-radius`, `--sbmd-callout-background`, `--sbmd-callout-radius`.
  - Links: `--sbmd-link-underline-offset`, `--sbmd-link-thickness`, `--sbmd-link-hover-thickness`, `--sbmd-link-focus-outline`, `--sbmd-link-focus-offset`, `--sbmd-link-radius`. Storybook's underline metrics and the browser focus ring apply.
  - Lists and checkboxes: `--sbmd-list-marker-color`, `--sbmd-checkbox-color`, `--sbmd-checkbox-gap`.
  - Headings: `--sbmd-title-letter-spacing`, `--sbmd-h2-letter-spacing`, `--sbmd-h3-letter-spacing`, `--sbmd-title-line-height`, `--sbmd-heading-line-height`.
  - Code: `--sbmd-code-border`, `--sbmd-inline-code-color`.
  - Tables: `--sbmd-table-background`, `--sbmd-table-heading-background`, `--sbmd-table-heading-weight`, `--sbmd-table-align`.
  - Tags: `--sbmd-tag-gap`, `--sbmd-tag-font-weight`, `--sbmd-tag-line-height`.
  - Callouts: `--sbmd-callout-color`, `--sbmd-callout-label-color`, `--sbmd-callout-label-size`, `--sbmd-callout-label-margin`.

  For properties the addon still sets, such as the `h2` padding or the tag gap, match the addon's specificity: `.sbdocs-content .storybook-addon-md-tags { gap: 0.5rem }`.

  **Migration**

  1. Set `--sbmd-border-color`, `--sbmd-block-spacing`, and `--sbmd-heading-spacing` to the values you used for the replaced variables.
  2. Rename `--sbmd-title-size` to `--sbmd-h1-size` and `--sbmd-inline-code-radius` to `--sbmd-code-radius`.
  3. Move any per-type callout border, background, or radius to a `.storybook-addon-md-callout[data-callout='...']` rule.
  4. Replace the remaining removed variables with CSS rules. The example stylesheet shows the pattern for links, images, and inline code.

## 0.5.0

### Minor Changes

- 76c1a71: Render GitHub-style alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]`) as labelled callouts in Docs. Ordinary blockquotes and unrecognized markers are unchanged, Markdown and relative assets inside callouts keep working, and manifests keep the original source.

  Style callouts with the new `--sbmd-callout-*` variables, including per-type accent colors, or target `.storybook-addon-md-callout[data-callout]`. Custom `MarkdownRenderer` implementations receive the original blockquote syntax and must render callouts themselves. See the [callout syntax](https://github.com/ruijdacd/storybook-addon-md#callouts) and [styling reference](https://github.com/ruijdacd/storybook-addon-md/blob/main/STYLING.md#callouts).

## 0.4.0

### Minor Changes

- 8bf5398: Respect `docs.defaultName`, use leading H1s as standalone titles, and add `tagFields` and the `storybook-addon-md/node` parsing API. Markdown pages retain props, examples, and original manifest source.

  Migration: update attached links from `--markdown` to `--docs` (or the configured name), enable Autodocs in preview-level tags, and render the supplied `heading` in custom layouts. MCP component IDs are unchanged.

## 0.3.0

### Minor Changes

- 2052cb5: Add opt-in documentation manifests with original Markdown, frontmatter summaries, and live updates for standalone and attached docs. Enable `manifests: true` to use [Storybook 10.6.0 manifests](https://storybook.js.org/docs/ai/manifests) and [@storybook/addon-mcp](https://storybook.js.org/docs/ai/mcp/overview) without a custom preset.

  See the [setup guide](https://github.com/ruijdacd/storybook-addon-md#documentation-manifests-and-mcp) and [examples with and without MCP](https://github.com/ruijdacd/storybook-addon-md#examples-and-contributing).

### Patch Changes

- d3c7300: Use rem values for default Markdown styles so they scale with the root font size. Add `--sbmd-monospace-font-family` to customize inline code and code blocks, with Storybook’s monospace theme font as the default. See the [CSS variable reference](https://github.com/ruijdacd/storybook-addon-md/blob/main/STYLING.md).

## 0.2.0

### Minor Changes

- dc93b21: Remove the `exclude` option. Move exclusions into `patterns` with a leading `!`:

  ```ts
  patterns: ['docs/**/*.md', '!docs/private/**'];
  ```

  Negative globs take precedence regardless of order. Configurations that still use `exclude` now report a migration error instead of silently including excluded files.

### Patch Changes

- dc93b21: Upgrade Chokidar to v5 and replace fast-glob with tinyglobby. Keep explicit glob matching, negative-pattern exclusions, and live Markdown updates.

## 0.1.0

Initial release.

- Discover ordinary Markdown through configurable include and exclude patterns.
- Render standalone pages or attach shared documentation to component stories.
- Support frontmatter, sibling-story associations, and status and tag chips.
- Bundle relative assets and update documentation during development.
- Customize Markdown rendering, layouts, stylesheets, and CSS variables.
- Include a GitHub-inspired example with system light and dark themes.

Tested with Storybook 10.6.0, React 19.2.4, and Vite 7.3.6.
