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
  nitro: {
    prerender: {
      failOnError: false,
    },
  },
})
