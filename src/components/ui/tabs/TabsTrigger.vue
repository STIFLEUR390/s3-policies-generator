<script setup lang="ts">
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: string
  class?: string
  disabled?: boolean
}>()

const activeTab = inject<import('vue').Ref<string>>('tabs-active')
const updateTab = inject<(val: string) => void>('tabs-update')

function isActive() {
  return activeTab && activeTab.value === props.value
}

function activate() {
  if (!props.disabled && updateTab) {
    updateTab(props.value)
  }
}

const triggerClass = computed(() => cn(
  'inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50',
  isActive()
    ? 'bg-background text-foreground shadow-sm border-input'
    : 'text-muted-foreground hover:text-foreground',
  props.class,
))
</script>

<template>
  <button
    role="tab"
    type="button"
    :aria-selected="isActive()"
    :data-state="isActive() ? 'active' : 'inactive'"
    :disabled="disabled"
    :class="triggerClass"
    @click="activate"
  >
    <slot />
  </button>
</template>
