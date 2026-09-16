# Contributing

Use Node 24.11+ and [Nub](https://nubjs.com/docs) 0.7.5.

```sh
nub install
nub exec playwright install chromium
nub run storybook
```

The repository uses a hoisted dependency layout and standard Node without Nub runtime hooks. CI installs from `nub.lock` with `--frozen-lockfile --ignore-scripts`.

The package build uses [tsdown](https://tsdown.dev) to emit ESM and TypeScript declarations and copy `src/styles.css` into `dist/`. `nub run check` runs the build followed by TypeScript type-checking.

## Checks

| Command                   | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `nub run check`           | Build and type-check the addon, examples, and tests. |
| `nub run lint`            | Run Oxlint.                                          |
| `nub run format:check`    | Check formatting. Use `nub run format` to fix it.    |
| `nub run test`            | Run Vitest unit tests.                               |
| `nub run test:browser`    | Run Vitest Browser Mode with Chromium.               |
| `nub run test:e2e`        | Verify development and static Storybooks.            |
| `nub run test:package`    | Verify an installed package in an isolated consumer. |
| `nub run build-storybook` | Build the example without MCP.                       |
| `nub pack`                | Build and package the addon.                         |

Watch modes are available through `test:watch` and `test:browser:watch`. End-to-end tests use ports 16006/16007 for the default example and 16009/16010 for the MCP example; the package check uses 16008. Run only one development Storybook per config directory when testing file watching.

End-to-end setup builds the addon once for all four Storybooks and builds the two static examples concurrently. Read-only rendering checks use two workers, then file-watching checks run sequentially to avoid changing shared fixtures during rendering tests. Screenshots are captured only on failure, and failure traces are retained. CI uploads a JSON report with per-test timings and runner metadata on every integration run. Example-only button and toggle color checks are omitted; addon theme coverage remains in the browser and end-to-end suites.

Pull requests run build/type checks, lint, formatting, the dependency audit, unit tests, and browser component tests. Pushes to `main` and manual CI runs also run the full end-to-end and packed-consumer suites. Checks, end-to-end tests, and the packed consumer run in independent jobs; the required `verify` job succeeds only when every applicable job succeeds. To check integration before merging, run the CI workflow manually on your branch. CI sets `PLAYWRIGHT_CHANNEL=chrome` for all browser suites to use Chrome already installed on the Ubuntu runner, avoiding browser downloads and system dependency installation. Its Chrome version follows runner-image updates. Local runs use Playwright's bundled Chromium unless you set `PLAYWRIGHT_CHANNEL`. CI cancels superseded runs on the same PR or branch.

Use `nub run storybook` for the default example on port 6006, or `nub run storybook:mcp` for the MCP example on port 6007. Build the latter with `nub run build-storybook:mcp`. Both configurations share the content and presentation in `example/`.

## Releases

Run `nub run changeset` for user-facing changes. Choose a version bump and include the generated release note in your PR. Tooling-only changes do not need one.

After CI passes on `main`, Changesets opens or updates a release PR with the version and changelog. Merging it publishes the package after CI passes again.

The release workflow checks out the exact commit that passed CI. A read-only job selects the release mode and builds and packs unpublished packages. Separate jobs update the release PR or publish the packed artifact. Only the publish job receives an npm OIDC token, and it skips lifecycle scripts. Checkouts do not retain GitHub credentials, privileged jobs disable dependency caches, and Dependabot keeps workflow action SHA pins up to date.

npm trusted publishing is configured for `timescale/storybook-addon-md`, workflow `release.yml`, with no environment. No `NPM_TOKEN` secret is needed. GitHub Actions must be allowed to create and approve pull requests in the repository settings.

Release PRs created with GitHub’s automatic token do not trigger PR workflows. If required checks block merging, close and reopen the PR yourself to trigger them. The release workflow always waits for CI on the merged commit.

Follow [e18e's publishing guidance](https://e18e.dev/docs/publishing.html) when maintaining repository settings. Keep private vulnerability reporting and approval for first-time contributors enabled, and require the `verify` status check on `main`. Enable required action SHA pinning after the pinned workflows are merged. A restricted publishing environment must also be configured in npm's trusted publisher before adding it to the workflow. Staged npm publishing is an optional switch from the current automatic release flow.

## Deploy the example

The [live example](https://storybook-addon-md.netlify.app) is deployed manually to Netlify from the default Storybook configuration. Build and deploy it with:

```sh
nub run build-storybook
npx netlify-cli deploy --site storybook-addon-md --no-build --prod
```

Sign in with `npx netlify-cli login` first. `netlify.toml` points to `storybook-static/`; only that build output is uploaded. Pushing to GitHub does not redeploy the example.
