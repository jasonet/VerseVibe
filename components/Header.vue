<template>
  <div class="header-row">
    <h1 class="title">VerseVibe <span class="version">V{{version}}</span></h1>
    <div v-if="$slots.right" class="header-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const version = process.env.VUE_APP_VERSION
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.title {
  font-size: 1.75em;
  margin: 0.5em 0;
  color: var(--fr-text-color-primary);
  font-weight: 600;
}

.version {
  font-size: 0.5em;
  opacity: 0.8;
}

.header-right {
  flex-shrink: 0;
}
</style>
