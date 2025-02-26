<script setup lang="ts">
  const title = ref('Frida Nuxt')
  new WebSocket('ws://localhost:3000/rpc')
</script>

<template>
  <h1>{{ title }}</h1>
</template>
