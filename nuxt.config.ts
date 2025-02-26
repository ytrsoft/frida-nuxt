export default defineNuxtConfig({
  compatibilityDate: '2025-02-26',
  devtools: { enabled: true },
  nitro: {
    experimental: {
      websocket: true
    }
  }
})
