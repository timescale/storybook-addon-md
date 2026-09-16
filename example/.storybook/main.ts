import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';
import type { MarkdownOptions } from '@tigerdata/storybook-addon-md';

export const markdownOptions = {
  patterns: ['docs/**/*.md', 'components/**/*.md', '!docs/drafts/**'],
  generatedDir: 'example-markdown-generated',
  stylesheet: '.storybook/markdown.css',
  links: { repository: 'https://github.com/timescale/storybook-addon-md/blob/main/example' },
} satisfies MarkdownOptions;

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../components/*.stories.tsx', '../docs/*.mdx'],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@tigerdata/storybook-addon-md',
      options: markdownOptions,
    },
  ],
  typescript: { reactDocgen: 'react-docgen-typescript' },

  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
    optimizeDeps: {
      ...config.optimizeDeps,
      include: [...(config.optimizeDeps?.include ?? []), 'clsx', 'class-variance-authority'],
    },
  }),
};

export default config;
