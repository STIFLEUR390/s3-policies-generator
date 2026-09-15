<script setup lang="ts">
import { ref, provide } from 'vue'

const props = defineProps<{
  modelValue?: string
  defaultValue?: string
  class?: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string): void
}>()

const activeTab = ref(props.modelValue ?? props.defaultValue ?? '')

provide('tabs-active', activeTab)
provide('tabs-update', (val: string) => {
  activeTab.value = val
  emits('update:modelValue', val)
})
</script>

<template>
  <div :class="class">
    <slot />
  </div>
</template>
