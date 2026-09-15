<template>
  <label class="flex items-start gap-2 cursor-pointer group" :class="containerClass">
    <input
      type="checkbox"
      :checked="modelValue"
      class="mt-0.5 h-4 w-4 shrink-0 rounded border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      <slot />
    </span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  containerClass?: string;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>
