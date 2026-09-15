<template>
  <Card>
    <CardHeader>
      <CardTitle>🧪 Testeur de policy</CardTitle>
      <CardDescription>
        Testez votre configuration en temps réel. Upload une image pour tester l'upload, ou vérifiez l'accès public.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <!-- Test file upload -->
      <div class="mb-4">
        <Label class="mb-1.5 block">Fichier de test (optionnel)</Label>
        <label class="flex items-center justify-center h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors text-center">
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
            <Button variant="ghost" size="icon" class="h-5 w-5 text-destructive" @click.stop="clearFile">✕</Button>
          </div>
        </label>
      </div>

      <!-- Test URL (for public read) -->
      <div v-if="currentCase === 'public-read' || currentCase === 'cloudfront-oac'" class="mb-4">
        <Label class="mb-1.5 block">URL publique à tester</Label>
        <Input
          v-model="testPublicUrl"
          :placeholder="`${endpoint}/${bucket}/${prefix}image.png`"
          class="font-mono"
        />
      </div>

      <!-- Run buttons -->
      <div class="flex flex-wrap gap-2 mb-4">
        <Button
          :disabled="testing || !hasCredentials"
          @click="runTests"
        >
          <span v-if="testing" class="animate-spin">⏳</span>
          <span v-else>▶</span>
          Tester
        </Button>
        <Button
          v-if="currentCase === 'public-read' || currentCase === 'cloudfront-oac'"
          variant="secondary"
          :disabled="testing || !testPublicUrl"
          @click="testPublic"
        >
          Tester URL publique
        </Button>
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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PolicyConfig, CaseId } from '../lib/policy';
import { testList, testRead, testWrite, testPublicRead, testDelete, type TestResult } from '../lib/s3test';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    const listResult = await testList(props.config);
    results.value.push(listResult);

    if (testFile.value && (props.currentCase === 'private' || props.currentCase === 'public-write' || props.currentCase === 'cross-account')) {
      const writeResult = await testWrite(props.config, testFile.value);
      results.value.push(writeResult);

      if (writeResult.ok) {
        const key = `${props.config.prefix.replace(/\/$/, '')}/${testFile.value.name}`;
        const readResult = await testRead(props.config, key);
        results.value.push(readResult);

        const deleteResult = await testDelete(props.config, key);
        results.value.push(deleteResult);
      }
    }

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

watch(() => props.currentCase, () => {
  results.value = [];
});
</script>
