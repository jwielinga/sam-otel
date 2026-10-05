import { themes as prismThemes } from 'prism-react-renderer'
import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const repository = 'https://github.com/jwielinga/sam-otel'

const config: Config = {
  title: 'Sam',
  tagline:
    'Send OpenTelemetry logs from the browser to any OTLP/HTTP collector',
  url: 'https://jwielinga.github.io',
  baseUrl: '/sam-otel/',
  organizationName: 'jwielinga',
  projectName: 'sam-otel',
  trailingSlash: false,
  onBrokenLinks: 'throw',

  // Plain `.md` files stay CommonMark; only `.mdx` files get JSX.
  markdown: {
    format: 'detect',
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          // The guides live in the repository's top-level docs folder, which also ships in the npm package.
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: ({ docPath }) => `${repository}/edit/main/docs/${docPath}`,
        },
        blog: false,
        theme: {},
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Sam',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          label: 'Docs',
          position: 'left',
        },
        {
          href: 'https://www.npmjs.com/package/sam-otel',
          label: 'npm',
          position: 'right',
        },
        { href: repository, label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: 'Sam is licensed under EUPL-1.2.',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
