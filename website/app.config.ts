export default defineAppConfig({
  shadcnDocs: {
    site: {
      name: 'Deepseek Kit',
      ogImageComponent: 'ShadcnDocs',
      description: 'A lightweight Agent framework with native-level DeepSeek adaptation. Precise tool calling in thinking mode · Reliable structured output · Maximum cache hit rate.',
    },
    theme: {
      customizable: false,
      color: 'zinc',
      radius: 0.5,
    },
    header: {
      title: 'DeepSeek Kit',
      showTitle: true,
      darkModeToggle: true,
      languageSwitcher: {
        enable: true,
        triggerType: 'icon',
        dropdownType: 'select',
      },
      logo: {
        light: '/logo.png',
        dark: '/logo-dark.png',
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
