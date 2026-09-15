<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="max-w-7xl mx-auto p-6">
      <h1 class="text-3xl font-bold text-primary mb-2">🪣 RustFS Policy Generator</h1>
      <p class="text-muted-foreground text-sm mb-6">
        Générez des policies S3/RustFS, exportez en Terraform/CloudFormation, et testez vos accès.
      </p>

      <!-- Case selector -->
      <div class="flex flex-wrap gap-2 mb-3">
        <button
          v-for="c in cases"
          :key="c.id"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors cursor-pointer',
            currentCase === c.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary text-secondary-foreground border-border hover:bg-accent',
          ]"
          @click="selectCase(c.id)"
        >
          {{ c.label }}
        </button>
      </div>
      <p class="text-muted-foreground text-xs mb-6">{{ currentCaseDef.description }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left: Config -->
        <div class="space-y-4">
          <!-- General params -->
          <div class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">Paramètres généraux</h2>
            <div class="space-y-3">
              <div>
                <label for="bucket" class="text-xs font-medium text-muted-foreground">Nom du bucket</label>
                <input id="bucket" v-model="bucket" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
              <div>
                <label for="prefix" class="text-xs font-medium text-muted-foreground">Préfixe (chemin dans le bucket)</label>
                <input id="prefix" v-model="prefix" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
              <div>
                <label for="endpoint" class="text-xs font-medium text-muted-foreground">Endpoint RustFS</label>
                <input id="endpoint" v-model="endpoint" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
              <div>
                <label for="region" class="text-xs font-medium text-muted-foreground">Région</label>
                <input id="region" v-model="region" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
            </div>
          </div>

          <!-- IAM credentials -->
          <div v-if="needsCredentials" class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">Utilisateur IAM</h2>
            <div class="space-y-3">
              <div>
                <label for="accessKey" class="text-xs font-medium text-muted-foreground">Access Key (nom utilisateur)</label>
                <input id="accessKey" v-model="accessKey" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
              <div>
                <label for="secretKey" class="text-xs font-medium text-muted-foreground">Secret Key</label>
                <input id="secretKey" v-model="secretKey" type="password" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
              </div>
            </div>
          </div>

          <!-- Advanced fields -->
          <div v-if="currentCase === 'cloudfront-oac'" class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">CloudFront</h2>
            <div>
              <label for="distId" class="text-xs font-medium text-muted-foreground">Distribution ID</label>
              <input id="distId" v-model="cloudfrontDistributionId" placeholder="E1ABCDEF123456" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
            </div>
          </div>

          <div v-if="currentCase === 'cross-account'" class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">Compte cible</h2>
            <div>
              <label for="accountId" class="text-xs font-medium text-muted-foreground">Account ID du compte distant</label>
              <input id="accountId" v-model="crossAccountAccountId" placeholder="123456789012" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
            </div>
          </div>

          <div v-if="currentCase === 'ip-restriction'" class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">Restriction IP</h2>
            <div>
              <label for="ipCidr" class="text-xs font-medium text-muted-foreground">CIDR autorisé</label>
              <input id="ipCidr" v-model="allowedIpCidr" placeholder="203.0.113.0/24" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
            </div>
          </div>

          <!-- Guardrails -->
          <div v-if="showGuardrails" class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-1">🛡️ Guardrails de sécurité</h2>
            <p class="text-muted-foreground text-xs mb-4">Deny statements ajoutés à la bucket policy pour renforcer la sécurité.</p>
            <div class="space-y-3">
              <label v-for="g in availableGuardrails" :key="g.id" class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" :value="g.id" v-model="enabledGuardrails" class="mt-0.5 h-4 w-4 shrink-0 rounded border border-primary shadow accent-primary" />
                <span class="text-sm">
                  <strong class="block">{{ g.label }}</strong>
                  <small class="text-muted-foreground text-xs">{{ g.description }}</small>
                </span>
              </label>
            </div>
            <div v-if="enabledGuardrails.includes('vpc-endpoint')" class="mt-3 pt-3 border-t border-border">
              <label for="vpcEp" class="text-xs font-medium text-muted-foreground">VPC Endpoint ID</label>
              <input id="vpcEp" v-model="vpcEndpointId" placeholder="vpce-xxxxxxxx" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
            </div>
            <div v-if="enabledGuardrails.includes('org-restriction')" class="mt-3 pt-3 border-t border-border">
              <label for="orgId" class="text-xs font-medium text-muted-foreground">Organization ID</label>
              <input id="orgId" v-model="organizationId" placeholder="o-xxxxxxxxxx" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
            </div>
          </div>
        </div>

        <!-- Right: Output -->
        <div>
          <div class="rounded-xl border bg-card p-5">
            <h2 class="font-semibold text-sm mb-4">Sortie</h2>

            <!-- Format tabs -->
            <div class="flex gap-1 border-b border-border mb-4">
              <button
                v-for="f in outputFormats"
                :key="f.id"
                :class="[
                  'px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px cursor-pointer',
                  outputFormat === f.id
                    ? 'border border-b-0 border-border bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                @click="outputFormat = f.id"
              >
                {{ f.label }}
              </button>
            </div>

            <!-- Bucket Policy -->
            <div class="mb-4">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-medium text-emerald-500">
                  {{ outputFormat === 'json' ? 'Bucket Policy' : outputFormatLabel }}
                </h3>
                <button class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors cursor-pointer" @click="copy('bucket')">
                  {{ copied === 'bucket' ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ bucketPolicyOutput }}</pre>
            </div>

            <!-- IAM Policy -->
            <div v-if="iamPolicyJson" class="mb-4">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-medium text-emerald-500">IAM Policy</h3>
                <button class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors cursor-pointer" @click="copy('iam')">
                  {{ copied === 'iam' ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ iamPolicyJson }}</pre>
            </div>

            <!-- .env -->
            <div class="mb-4">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-medium text-emerald-500">.env</h3>
                <button class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors cursor-pointer" @click="copy('env')">
                  {{ copied === 'env' ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ envOutput }}</pre>
            </div>

            <!-- Admin Commands -->
            <div class="mb-4">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-medium text-emerald-500">Commandes RustFS Admin</h3>
                <button class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors cursor-pointer" @click="copy('cmds')">
                  {{ copied === 'cmds' ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ cmdsOutput }}</pre>
            </div>

            <!-- Node.js Snippet -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-medium text-emerald-500">Node.js Snippet</h3>
                <button class="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded hover:bg-accent transition-colors cursor-pointer" @click="copy('node')">
                  {{ copied === 'node' ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ nodeOutput }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  type CaseId,
  type CaseDef,
  type PolicyConfig,
  buildBucketPolicy,
  buildIamPolicy,
  buildEnv,
  buildCommands,
  buildNode,
} from '../lib/policy';
import { guardrails, applyGuardrails } from '../lib/guardrails';
import { toTerraform, toCloudFormation, toCli } from '../lib/iac';

const cases: CaseDef[] = [
  { id: 'private', label: 'Privé (auth)', category: 'preset', description: 'Accès complet via credentials IAM. Anonymous denied.' },
  { id: 'public-read', label: 'Lecture publique', category: 'preset', description: 'Objets lisibles par tous. Écriture/listing refusés.' },
  { id: 'public-write', label: 'Public + Auth Write', category: 'preset', description: 'Lecture publique, écriture authentifiée uniquement.' },
  { id: 'cloudfront-oac', label: 'CloudFront OAC', category: 'advanced', description: 'Autorise uniquement une distribution CloudFront via Origin Access Control.' },
  { id: 'cross-account', label: 'Cross-account', category: 'advanced', description: 'Accès depuis un autre compte AWS.' },
  { id: 'deny-insecure', label: 'Deny insecure transport', category: 'advanced', description: 'Bloque tout accès non-HTTPS. À combiner avec un autre cas.' },
  { id: 'ip-restriction', label: 'Restriction IP', category: 'advanced', description: "N'autorise qu'un CIDR IP spécifique." },
  { id: 'mfa-required', label: 'MFA requis', category: 'advanced', description: 'Exige MFA pour les écritures/suppressions.' },
];

const prefixDefaults: Record<CaseId, string> = {
  private: 'private/',
  'public-read': 'public/',
  'public-write': 'uploads/',
  'cloudfront-oac': 'assets/',
  'cross-account': 'shared/',
  'deny-insecure': 'data/',
  'ip-restriction': 'internal/',
  'mfa-required': 'secure/',
};

const currentCase = ref<CaseId>('private');
const outputFormat = ref<'json' | 'terraform' | 'cloudformation' | 'cli'>('json');
const bucket = ref('my-bucket');
const prefix = ref('private/');
const endpoint = ref('http://localhost:9000');
const region = ref('us-east-1');
const accessKey = ref('app-user');
const secretKey = ref('ChangeMe-StrongSecret!');
const cloudfrontDistributionId = ref('');
const crossAccountAccountId = ref('');
const allowedIpCidr = ref('203.0.113.0/24');
const vpcEndpointId = ref('');
const organizationId = ref('');
const enabledGuardrails = ref<string[]>([]);
const copied = ref<string | null>(null);

const currentCaseDef = computed(() => cases.find((c) => c.id === currentCase.value)!);
const needsCredentials = computed(() => !['public-read', 'cloudfront-oac'].includes(currentCase.value));
const showGuardrails = computed(() => !['cloudfront-oac'].includes(currentCase.value));
const availableGuardrails = computed(() => guardrails.filter((g) => !g.conflictsWith?.includes(currentCase.value)));

const outputFormats = [
  { id: 'json' as const, label: 'JSON' },
  { id: 'terraform' as const, label: 'Terraform' },
  { id: 'cloudformation' as const, label: 'CloudFormation' },
  { id: 'cli' as const, label: 'CLI' },
];

const outputFormatLabel = computed(() => outputFormats.find((f) => f.id === outputFormat.value)?.label ?? 'JSON');

const config = computed<PolicyConfig>(() => ({
  bucket: bucket.value,
  prefix: prefix.value,
  endpoint: endpoint.value,
  region: region.value,
  accessKey: accessKey.value,
  secretKey: secretKey.value,
  cloudfrontDistributionId: cloudfrontDistributionId.value,
  crossAccountAccountId: crossAccountAccountId.value,
  allowedIpCidr: allowedIpCidr.value,
  vpcEndpointId: vpcEndpointId.value,
  organizationId: organizationId.value,
}));

const bucketPolicy = computed(() => {
  const base = buildBucketPolicy(currentCase.value, config.value);
  if (enabledGuardrails.value.length > 0) {
    return { ...base, Statement: applyGuardrails(base.Statement, enabledGuardrails.value, config.value) };
  }
  return base;
});

const bucketPolicyJson = computed(() => JSON.stringify(bucketPolicy.value, null, 2));

const bucketPolicyOutput = computed(() => {
  switch (outputFormat.value) {
    case 'terraform': return toTerraform(bucketPolicy.value, config.value);
    case 'cloudformation': return toCloudFormation(bucketPolicy.value, config.value);
    case 'cli': return toCli(bucketPolicy.value, config.value);
    default: return bucketPolicyJson.value;
  }
});

const iamPolicyJson = computed(() => {
  const iam = buildIamPolicy(currentCase.value, config.value);
  return iam ? JSON.stringify(iam, null, 2) : null;
});

const envOutput = computed(() => buildEnv(currentCase.value, config.value));
const cmdsOutput = computed(() => buildCommands(currentCase.value, config.value));
const nodeOutput = computed(() => buildNode(currentCase.value, config.value));

function selectCase(id: CaseId) {
  currentCase.value = id;
  prefix.value = prefixDefaults[id];
}

function copy(key: string) {
  const textMap: Record<string, string> = {
    bucket: bucketPolicyOutput.value,
    iam: iamPolicyJson.value ?? '',
    env: envOutput.value,
    cmds: cmdsOutput.value,
    node: nodeOutput.value,
  };
  navigator.clipboard.writeText(textMap[key]);
  copied.value = key;
  setTimeout(() => (copied.value = null), 1500);
}
</script>
