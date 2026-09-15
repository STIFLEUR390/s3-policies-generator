<script setup lang="ts">
import { inject } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: string
  class?: string
}>()

const activeTab = inject<import('vue').Ref<string>>('tabs-active')

function isActive() {
  return activeTab && activeTab.value === props.value
}
</script>

<template>
  <div
    v-if="isActive()"
    role="tabpanel"
    :data-state="isActive() ? 'active' : 'inactive'"
    :class="cn('flex-1 outline-none', props.class)"
  >
    <slot />
  </div>
</template>
