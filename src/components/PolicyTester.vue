<template>
  <div class="rounded-xl border bg-card p-5">
    <h2 class="font-semibold text-sm mb-1">🧪 Testeur de policy</h2>
    <p class="text-muted-foreground text-xs mb-4">
      Testez votre configuration en temps réel. Upload une image pour tester l'upload, ou vérifiez l'accès public.
    </p>

    <!-- Test file upload -->
    <div class="mb-4">
      <label class="text-xs font-medium text-muted-foreground block mb-1.5">Fichier de test (optionnel)</label>
      <div class="flex items-center gap-2">
        <label
          class="flex-1 flex items-center justify-center h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors text-center"
        >
          <input type="file" class="hidden" accept="image/*" @change="onFileSelect" />
          <div v-if="!testFile">
            <p class="text-xs text-muted-foreground">Glissez ou cliquez pour uploader</p>
            <p class="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG, WebP…</p>
          </div>
          <div v-else class="flex items-center gap-2 px-3">
            <img v-if="previewUrl" :src="previewUrl" class="h-12 w-12 rounded object-cover" alt="Preview" />
            <div class="text-left">
              <p class="text-xs font-medium">{{ testFile.name }}</p>
              <p class="text-[10px] text-muted-foreground">{{ formatSize(testFile.size) }}</p>
            </div>
            <button class="text-destructive text-xs ml-2 cursor-pointer" @click.stop="clearFile">✕</button>
          </div>
        </label>
      </div>
    </div>

    <!-- Test URL (for public read) -->
    <div v-if="currentCase === 'public-read' || currentCase === 'cloudfront-oac'" class="mb-4">
      <label class="text-xs font-medium text-muted-foreground block mb-1.5">URL publique à tester</label>
      <input
        v-model="testPublicUrl"
        :placeholder="`${endpoint}/${bucket}/${prefix}image.png`"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
      />
    </div>

    <!-- Run buttons -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="testing || !hasCredentials"
        @click="runTests"
      >
        <span v-if="testing" class="animate-spin">⏳</span>
        <span v-else>▶</span>
        Tester
      </button>
      <button
        v-if="currentCase === 'public-read' || currentCase === 'cloudfront-oac'"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors cursor-pointer disabled:opacity-50"
        :disabled="testing || !testPublicUrl"
        @click="testPublic"
      >
        Tester URL publique
      </button>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="space-y-2">
      <div
        v-for="(r, i) in results"
        :key="i"
        :class="[
          'rounded-md p-3 text-xs border',
          r.ok
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            : 'bg-destructive/10 border-destructive/30 text-destructive',
        ]"
      >
        <div class="flex items-start gap-2">
          <span>{{ r.ok ? '✅' : '❌' }}</span>
          <div class="flex-1">
            <p class="font-medium">{{ r.message }}</p>
            <p v-if="r.url" class="text-muted-foreground mt-0.5 break-all">{{ r.url }}</p>
            <p v-if="r.details" class="text-muted-foreground mt-1 font-mono text-[10px] whitespace-pre-wrap">{{ r.details }}</p>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!hasCredentials && currentCase !== 'public-read' && currentCase !== 'cloudfront-oac'" class="text-muted-foreground text-xs mt-2">
      Remplissez les champs IAM (endpoint, access key, secret key) pour lancer les tests.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PolicyConfig, CaseId } from '../lib/policy';
import { testList, testRead, testWrite, testPublicRead, type TestResult } from '../lib/s3test';

const props = defineProps<{
  config: PolicyConfig;
  currentCase: CaseId;
}>();

const testFile = ref<File | null>(null);
const previewUrl = ref('');
const testPublicUrl = ref('');
const testing = ref(false);
const results = ref<TestResult[]>([]);

const hasCredentials = computed(() =>
  props.config.accessKey && props.config.secretKey && props.config.endpoint,
);

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    testFile.value = file;
    if (file.type.startsWith('image/')) {
      previewUrl.value = URL.createObjectURL(file);
    }
  }
}

function clearFile() {
  testFile.value = null;
  previewUrl.value = '';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function runTests() {
  testing.value = true;
  results.value = [];

  try {
    // Test 1: List
    const listResult = await testList(props.config);
    results.value.push(listResult);

    // Test 2: Write (if file provided)
    if (testFile.value && (props.currentCase === 'private' || props.currentCase === 'public-write' || props.currentCase === 'cross-account')) {
      const writeResult = await testWrite(props.config, testFile.value);
      results.value.push(writeResult);

      // Test 3: Read back what we just uploaded
      if (writeResult.ok) {
        const key = `${props.config.prefix.replace(/\/$/, '')}/${testFile.value.name}`;
        const readResult = await testRead(props.config, key);
        results.value.push(readResult);

        // Test 4: Delete
        const { testDelete } = await import('../lib/s3test');
        const deleteResult = await testDelete(props.config, key);
        results.value.push(deleteResult);
      }
    }

    // Test: Read (private case without file)
    if (props.currentCase === 'private' && !testFile.value) {
      const readResult = await testRead(props.config, `${props.config.prefix}test.txt`);
      results.value.push(readResult);
    }
  } finally {
    testing.value = false;
  }
}

async function testPublic() {
  testing.value = true;
  results.value = [];
  try {
    const result = await testPublicRead(testPublicUrl.value);
    results.value.push(result);
  } finally {
    testing.value = false;
  }
}

// Reset results when case changes
watch(() => props.currentCase, () => {
  results.value = [];
});
</script>
