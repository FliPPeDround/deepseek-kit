export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/i18n'],
  extends: ['shadcn-docs-nuxt'],
  // site: {
  //   url: 'https://deepseek-kit.vercel.com',
  // },

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
