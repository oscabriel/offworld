import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'OFFWORLD DOCS',
    },
    links: [
      {
        text: 'Check Out App',
        url: 'https://offworld.sh',
      },
      {
        text: 'Read Source Code',
        url: 'https://github.com/oscabriel/offworld',
      },
    ],
  };
}
