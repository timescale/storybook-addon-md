# Contributing

Use Node 24.11+ and the repository's `./bun` wrapper. It downloads the pinned [Bun](https://bun.sh) version into `download/` on first use, so no global install is needed.

```sh
./bun install
./bun x playwright install chromium
./bun run storybook
```

Bun installs and runs scripts; tests, Storybook, and the build still run on Node. CI installs from `bun.lock` with `--frozen-lockfile --ignore-scripts`.

The package build uses [tsdown](https://tsdown.dev) to emit ESM and TypeScript declarations and copy `src/styles.css` into `dist/`. `./bun run check` runs the build followed by TypeScript type-checking.

## Checks

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `./bun run check`           | Build and type-check the addon, examples, and tests. |
| `./bun run lint`            | Run Oxlint.                                          |
| `./bun run format:check`    | Check formatting. Use `./bun run format` to fix it.  |
| `./bun run test`            | Run Vitest unit tests.                               |
| `./bun run test:browser`    | Run Vitest Browser Mode with Chromium.               |
| `./bun run test:e2e`        | Verify development and static Storybooks.            |
| `./bun run test:package`    | Verify an installed package in an isolated consumer. |
| `./bun run build-storybook` | Build the example without MCP.                       |
| `./bun pm pack`             | Build and package the addon.                         |

Watch modes are available through `test:watch` and `test:browser:watch`. End-to-end tests use ports 16006/16007 for the default example and 16009/16010 for the MCP example; the package check uses 16008. Run only one development Storybook per config directory when testing file watching.

End-to-end setup builds the addon once for all four Storybooks and builds the two static examples concurrently. Read-only rendering checks use two workers, then file-watching checks run sequentially to avoid changing shared fixtures during rendering tests. Screenshots are captured only on failure, and failure traces are retained. CI uploads a JSON report with per-test timings and runner metadata on every integration run. Example-only button and toggle color checks are omitted; addon theme coverage remains in the browser and end-to-end suites.

Pull requests run build/type checks, lint, formatting, the dependency audit, unit tests, and browser component tests. Pushes to `main` and manual CI runs also run the full end-to-end and packed-consumer suites. Checks, end-to-end tests, and the packed consumer run in independent jobs; the required `verify` job succeeds only when every applicable job succeeds. To check integration before merging, run the CI workflow manually on your branch. CI sets `PLAYWRIGHT_CHANNEL=chrome` for all browser suites to use Chrome already installed on the Ubuntu runner, avoiding browser downloads and system dependency installation. Its Chrome version follows runner-image updates. Local runs use Playwright's bundled Chromium unless you set `PLAYWRIGHT_CHANNEL`. CI cancels superseded runs on the same PR or branch.

Use `./bun run storybook` for the default example on port 6006, or `./bun run storybook:mcp` for the MCP example on port 6007. Build the latter with `./bun run build-storybook:mcp`. Both configurations share the content and presentation in `example/`.

## Releases

Releases are cut with the release script. Do not create the tag or release in the GitHub UI. The version is hard-coded in `package.json`, and npm rejects a publish whose version already exists, so a tag pushed without the bump fails the workflow and burns the version number.

Run `./bun install` first, then:

```sh
./bun run release 0.10.0   # explicit version
./bun run release patch    # or: major | minor | patch, relative to package.json
```

The script:

1. Checks that the working tree is clean, you are on `main`, local `main` is not behind `origin/main`, the version is valid semver and greater than the current one, and the tag does not already exist.
2. Writes the new version into `package.json`.
3. Commits it as `release: vX.Y.Z`, creates an annotated `vX.Y.Z` tag, and runs `git push --follow-tags`.

The tag push triggers the Publish workflow (`.github/workflows/publish.yml`), which installs with Bun and runs `npm publish`. The `prepack` script builds `dist/` first. Create the GitHub Release from the tag afterward for release notes.

You need permission to push directly to `main`. A repository rule requiring pull requests blocks the commit push but not the tag push, which leaves the tag published while `main` still has the old version. If that happens, push the local release commit to `main` with admin bypass so the tag's commit is on `main`.

Publishing authenticates with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers). The `@tigerdata/storybook-addon-md` package on npm has a GitHub Actions trusted publisher for `timescale/storybook-addon-md`, workflow `publish.yml`, with no environment. No `NPM_TOKEN` secret is needed. A brand-new package name must be published once by hand before a trusted publisher can be attached to it.

Follow [e18e's publishing guidance](https://e18e.dev/docs/publishing.html) when maintaining repository settings. Keep private vulnerability reporting and approval for first-time contributors enabled, and require the `verify` status check on `main`. Dependabot keeps workflow action SHA pins up to date.

## Deploy the example

The [live example](https://storybook-addon-md.netlify.app) is deployed manually to Netlify from the default Storybook configuration. Build and deploy it with:

```sh
./bun run build-storybook
npx netlify-cli deploy --site storybook-addon-md --no-build --prod
```

Sign in with `npx netlify-cli login` first. `netlify.toml` points to `storybook-static/`; only that build output is uploaded. Pushing to GitHub does not redeploy the example.
