import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Offworld',
    },
    links: [
      {
        text: 'App',
        url: 'https://offworld.sh',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/oscabriel/offworld',
      },
    ],
  };
}
