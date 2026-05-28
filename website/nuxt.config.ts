export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/i18n'],
  extends: ['shadcn-docs-nuxt'],

  i18n: {
    defaultLocale: 'en',
    locales: [
      {
        code: 'en',
        name: 'English',
        language: 'en-US',
      },
      {
        code: 'zh',
        name: '简体中文',
        language: 'zh-CN',
      },
    ],
  },
  compatibilityDate: '2024-07-06',
  ogImage: {
    zeroRuntime: true,
  },
  content: {
    highlight: {
      preload: ['json', 'ts', 'bash', 'yaml', 'mermaid'],
    },
  },
  vite: {
    build: {
      sourcemap: false,
    },
  },
  nitro: {
    sourceMap: false,
    prerender: {
      failOnError: false,
    },
  },
})
