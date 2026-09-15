<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    class="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  placeholder?: string;
  rows?: number;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>
