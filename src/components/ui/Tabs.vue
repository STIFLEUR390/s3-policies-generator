<template>
  <div>
    <div class="flex gap-1 border-b mb-4">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors -mb-px',
          modelValue === tab.id
            ? 'border border-b-0 border-border bg-background text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        ]"
        @click="$emit('update:modelValue', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tabs: Array<{ id: string; label: string }>;
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>
