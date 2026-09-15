<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue?: boolean
  disabled?: boolean
  class?: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: boolean): void
}>()

function toggle() {
  if (!props.disabled) {
    emits('update:modelValue', !props.modelValue)
  }
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    :data-state="modelValue ? 'checked' : 'unchecked'"
    :disabled="disabled"
    :class="cn(
      'peer border-input size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
      props.class,
    )"
    @click="toggle"
  >
    <span v-if="modelValue" class="flex items-center justify-center text-current">
      <Check class="size-3.5" />
    </span>
  </button>
</template>
