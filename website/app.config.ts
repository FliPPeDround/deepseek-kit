export default defineAppConfig({
  shadcnDocs: {
    site: {
      name: 'deepseek-kit',
      description: 'A TypeScript Agent framework based on the DeepSeek API.',
    },
    theme: {
      customizable: false,
      color: 'zinc',
      radius: 0.5,
    },
    header: {
      title: 'deepseek-kit',
      showTitle: true,
      darkModeToggle: true,
      languageSwitcher: {
        enable: true,
        triggerType: 'icon',
        dropdownType: 'select',
      },
      logo: {
        light: '/logo.svg',
        dark: '/logo-dark.svg',
      },
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/flippedround/deepseek-kit',
        target: '_blank',
      }],
    },
    aside: {
      useLevel: true,
      collapse: false,
    },
    main: {
      breadCrumb: true,
      showTitle: true,
    },
    footer: {
      credits: 'Copyright © 2026 FliPPeDround',
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/flippedround/deepseek-kit',
        target: '_blank',
      }],
    },
    toc: {
      enable: true,
      links: [{
        title: 'Star on GitHub',
        icon: 'lucide:star',
        to: 'https://github.com/flippedround/deepseek-kit',
        target: '_blank',
      }, {
        title: 'Create Issues',
        icon: 'lucide:circle-dot',
        to: 'https://github.com/flippedround/deepseek-kit/issues',
        target: '_blank',
      }],
    },
    search: {
      enable: true,
      inAside: false,
    },
  },
})
