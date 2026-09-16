---
'storybook-addon-md': minor
---

Rendered links now behave correctly on their own. Docs links keep the absolute manager URL and navigate through the Storybook channel on a plain click, so the preview no longer reloads; modified clicks and non-primary buttons fall through to the browser. External links open in a new tab with `rel="noopener noreferrer"`, both kinds carry a `data-link` attribute, and explicit `target` or `rel` attributes are preserved. `Anchor` is exported from `storybook-addon-md/runtime` for custom renderers.

Docs links no longer set `target="_top"`. Stylesheets or tests that relied on that attribute should target `[data-link="docs"]` instead.
