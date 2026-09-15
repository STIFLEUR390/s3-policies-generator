<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="max-w-7xl mx-auto p-6">
      <h1 class="text-3xl font-bold text-primary mb-2">🪣 RustFS Policy Generator</h1>
      <p class="text-muted-foreground text-sm mb-6">
        Générez des policies S3/RustFS, exportez en Terraform/CloudFormation, et testez vos accès.
      </p>

      <!-- Case selector -->
      <div class="flex flex-wrap gap-2 mb-3">
        <Button
          v-for="c in cases"
          :key="c.id"
          :variant="currentCase === c.id ? 'default' : 'outline'"
          size="sm"
          @click="selectCase(c.id)"
        >
          {{ c.label }}
        </Button>
      </div>
      <p class="text-muted-foreground text-xs mb-6">{{ currentCaseDef.description }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left: Config -->
        <div class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres généraux</CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
              <div>
                <Label for="bucket">Nom du bucket</Label>
                <Input id="bucket" v-model="bucket" class="font-mono" />
              </div>
              <div>
                <Label for="prefix">Préfixe (chemin dans le bucket)</Label>
                <Input id="prefix" v-model="prefix" class="font-mono" />
              </div>
              <div>
                <Label for="endpoint">Endpoint RustFS</Label>
                <Input id="endpoint" v-model="endpoint" class="font-mono" />
              </div>
              <div>
                <Label for="region">Région</Label>
                <Input id="region" v-model="region" class="font-mono" />
              </div>
            </CardContent>
          </Card>

          <Card v-if="needsCredentials">
            <CardHeader>
              <CardTitle>Utilisateur IAM</CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
              <div>
                <Label for="accessKey">Access Key (nom utilisateur)</Label>
                <Input id="accessKey" v-model="accessKey" class="font-mono" />
              </div>
              <div>
                <Label for="secretKey">Secret Key</Label>
                <Input id="secretKey" v-model="secretKey" type="password" class="font-mono" />
              </div>
            </CardContent>
          </Card>

          <!-- Advanced fields -->
          <Card v-if="currentCase === 'cloudfront-oac'">
            <CardHeader>
              <CardTitle>CloudFront</CardTitle>
            </CardHeader>
            <CardContent>
              <Label for="distId">Distribution ID</Label>
              <Input id="distId" v-model="cloudfrontDistributionId" placeholder="E1ABCDEF123456" class="font-mono" />
            </CardContent>
          </Card>

          <Card v-if="currentCase === 'cross-account'">
            <CardHeader>
              <CardTitle>Compte cible</CardTitle>
            </CardHeader>
            <CardContent>
              <Label for="accountId">Account ID du compte distant</Label>
              <Input id="accountId" v-model="crossAccountAccountId" placeholder="123456789012" class="font-mono" />
            </CardContent>
          </Card>

          <Card v-if="currentCase === 'ip-restriction'">
            <CardHeader>
              <CardTitle>Restriction IP</CardTitle>
            </CardHeader>
            <CardContent>
              <Label for="ipCidr">CIDR autorisé</Label>
              <Input id="ipCidr" v-model="allowedIpCidr" placeholder="203.0.113.0/24" class="font-mono" />
            </CardContent>
          </Card>

          <!-- Guardrails -->
          <Card v-if="showGuardrails">
            <CardHeader>
              <CardTitle>🛡️ Guardrails de sécurité</CardTitle>
              <CardDescription>Deny statements ajoutés à la bucket policy pour renforcer la sécurité.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div v-for="g in availableGuardrails" :key="g.id" class="flex items-start gap-2">
                <Checkbox :model-value="enabledGuardrails.includes(g.id)" @update:model-value="toggleGuardrail(g.id)" class="mt-0.5" />
                <div>
                  <span class="text-sm font-medium">{{ g.label }}</span>
                  <p class="text-xs text-muted-foreground">{{ g.description }}</p>
                </div>
              </div>
              <div v-if="enabledGuardrails.includes('vpc-endpoint')" class="mt-3 pt-3 border-t border-border">
                <Label for="vpcEp">VPC Endpoint ID</Label>
                <Input id="vpcEp" v-model="vpcEndpointId" placeholder="vpce-xxxxxxxx" class="font-mono" />
              </div>
              <div v-if="enabledGuardrails.includes('org-restriction')" class="mt-3 pt-3 border-t border-border">
                <Label for="orgId">Organization ID</Label>
                <Input id="orgId" v-model="organizationId" placeholder="o-xxxxxxxxxx" class="font-mono" />
              </div>
            </CardContent>
          </Card>

          <!-- Tester -->
          <PolicyTester :config="config" :current-case="currentCase" />
        </div>

        <!-- Right: Output -->
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Sortie</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs v-model="outputFormat">
                <TabsList>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="terraform">Terraform</TabsTrigger>
                  <TabsTrigger value="cloudformation">CloudFormation</TabsTrigger>
                  <TabsTrigger value="cli">CLI</TabsTrigger>
                </TabsList>

                <TabsContent value="json" />
                <TabsContent value="terraform" />
                <TabsContent value="cloudformation" />
                <TabsContent value="cli" />
              </Tabs>

              <!-- Bucket Policy -->
              <div class="mt-4 mb-4">
                <div class="flex items-center justify-between mb-1">
                  <h3 class="text-sm font-medium text-emerald-500">
                    {{ outputFormat === 'json' ? 'Bucket Policy' : outputFormatLabel }}
                  </h3>
                  <Button variant="secondary" size="sm" class="h-6 text-xs" @click="copy('bucket')">
                    {{ copied === 'bucket' ? 'Copié ✓' : 'Copier' }}
                  </Button>
                </div>
                <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ bucketPolicyOutput }}</pre>
              </div>

              <!-- IAM Policy -->
              <div v-if="iamPolicyJson" class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <h3 class="text-sm font-medium text-emerald-500">IAM Policy</h3>
                  <Button variant="secondary" size="sm" class="h-6 text-xs" @click="copy('iam')">
                    {{ copied === 'iam' ? 'Copié ✓' : 'Copier' }}
                  </Button>
                </div>
                <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ iamPolicyJson }}</pre>
              </div>

              <!-- .env -->
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <h3 class="text-sm font-medium text-emerald-500">.env</h3>
                  <Button variant="secondary" size="sm" class="h-6 text-xs" @click="copy('env')">
                    {{ copied === 'env' ? 'Copié ✓' : 'Copier' }}
                  </Button>
                </div>
                <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ envOutput }}</pre>
              </div>

              <!-- Admin Commands -->
              <div class="mb-4">
                <div class="flex items-center justify-between mb-1">
                  <h3 class="text-sm font-medium text-emerald-500">Commandes RustFS Admin</h3>
                  <Button variant="secondary" size="sm" class="h-6 text-xs" @click="copy('cmds')">
                    {{ copied === 'cmds' ? 'Copié ✓' : 'Copier' }}
                  </Button>
                </div>
                <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ cmdsOutput }}</pre>
              </div>

              <!-- Node.js Snippet -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <h3 class="text-sm font-medium text-emerald-500">Node.js Snippet</h3>
                  <Button variant="secondary" size="sm" class="h-6 text-xs" @click="copy('node')">
                    {{ copied === 'node' ? 'Copié ✓' : 'Copier' }}
                  </Button>
                </div>
                <pre class="bg-background border border-border rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">{{ nodeOutput }}</pre>
              </div>
            </CardContent>
          </Card>
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PolicyTester from './PolicyTester.vue';

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
const outputFormat = ref('json');
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

const outputFormatLabel = computed(() => {
  const map: Record<string, string> = { json: 'JSON', terraform: 'Terraform', cloudformation: 'CloudFormation', cli: 'CLI' };
  return map[outputFormat.value] ?? 'JSON';
});

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

function toggleGuardrail(id: string) {
  const idx = enabledGuardrails.value.indexOf(id);
  if (idx >= 0) enabledGuardrails.value.splice(idx, 1);
  else enabledGuardrails.value.push(id);
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
