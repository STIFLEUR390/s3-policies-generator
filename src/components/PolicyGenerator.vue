<template>
  <div class="app">
    <h1>🪣 RustFS Policy Generator</h1>

    <!-- Case selector -->
    <div class="case-selector">
      <button
        v-for="c in cases"
        :key="c.id"
        :class="{ active: currentCase === c.id }"
        @click="selectCase(c.id)"
      >
        {{ c.label }}
      </button>
    </div>

    <p class="case-desc">{{ currentCaseDef.description }}</p>

    <div class="grid">
      <!-- Left: Config -->
      <div>
        <fieldset>
          <legend>Paramètres généraux</legend>
          <label for="bucket">Nom du bucket</label>
          <input id="bucket" v-model="bucket" />
          <label for="prefix">Préfixe (chemin dans le bucket)</label>
          <input id="prefix" v-model="prefix" />
          <label for="endpoint">Endpoint RustFS</label>
          <input id="endpoint" v-model="endpoint" />
          <label for="region">Région</label>
          <input id="region" v-model="region" />
        </fieldset>

        <fieldset v-if="needsCredentials">
          <legend>Utilisateur IAM</legend>
          <label for="accessKey">Access Key (nom utilisateur)</label>
          <input id="accessKey" v-model="accessKey" />
          <label for="secretKey">Secret Key</label>
          <input id="secretKey" v-model="secretKey" type="password" />
        </fieldset>

        <!-- Advanced fields -->
        <fieldset v-if="currentCase === 'cloudfront-oac'">
          <legend>CloudFront</legend>
          <label for="distId">Distribution ID</label>
          <input id="distId" v-model="cloudfrontDistributionId" placeholder="E1ABCDEF123456" />
        </fieldset>

        <fieldset v-if="currentCase === 'cross-account'">
          <legend>Compte cible</legend>
          <label for="accountId">Account ID du compte distant</label>
          <input id="accountId" v-model="crossAccountAccountId" placeholder="123456789012" />
        </fieldset>

        <fieldset v-if="currentCase === 'ip-restriction'">
          <legend>Restriction IP</legend>
          <label for="ipCidr">CIDR autorisé</label>
          <input id="ipCidr" v-model="allowedIpCidr" placeholder="203.0.113.0/24" />
        </fieldset>

        <!-- Guardrails -->
        <fieldset v-if="showGuardrails">
          <legend>🛡️ Guardrails de sécurité</legend>
          <p class="guardrail-hint">
            Deny statements ajoutés à la bucket policy pour renforcer la sécurité.
          </p>
          <div v-for="g in availableGuardrails" :key="g.id" class="guardrail-item">
            <label class="guardrail-label">
              <input type="checkbox" :value="g.id" v-model="enabledGuardrails" />
              <span>
                <strong>{{ g.label }}</strong>
                <small>{{ g.description }}</small>
              </span>
            </label>
          </div>
          <div v-if="currentCase === 'vpc-endpoint' || enabledGuardrails.includes('vpc-endpoint')" class="guardrail-extra">
            <label for="vpcEp">VPC Endpoint ID</label>
            <input id="vpcEp" v-model="vpcEndpointId" placeholder="vpce-xxxxxxxx" />
          </div>
          <div v-if="enabledGuardrails.includes('org-restriction')" class="guardrail-extra">
            <label for="orgId">Organization ID</label>
            <input id="orgId" v-model="organizationId" placeholder="o-xxxxxxxxxx" />
          </div>
        </fieldset>
      </div>

      <!-- Right: Output -->
      <div>
        <fieldset>
          <legend>Sortie</legend>

          <!-- Format tabs -->
          <div class="format-tabs">
            <button
              v-for="f in outputFormats"
              :key="f.id"
              :class="{ active: outputFormat === f.id }"
              @click="outputFormat = f.id"
            >
              {{ f.label }}
            </button>
          </div>

          <!-- Bucket Policy output -->
          <div class="output-block">
            <h3>
              {{ outputFormat === 'json' ? 'Bucket Policy' : outputFormatLabel }}
              <button class="copy-btn" @click="copy('bucket')">
                {{ copied === 'bucket' ? 'Copié ✓' : 'Copier' }}
              </button>
            </h3>
            <pre>{{ bucketPolicyOutput }}</pre>
          </div>

          <!-- IAM Policy -->
          <div v-if="iamPolicyJson" class="output-block">
            <h3>
              IAM Policy
              <button class="copy-btn" @click="copy('iam')">
                {{ copied === 'iam' ? 'Copié ✓' : 'Copier' }}
              </button>
            </h3>
            <pre>{{ iamPolicyJson }}</pre>
          </div>

          <!-- .env -->
          <div class="output-block">
            <h3>
              .env
              <button class="copy-btn" @click="copy('env')">
                {{ copied === 'env' ? 'Copié ✓' : 'Copier' }}
              </button>
            </h3>
            <pre>{{ envOutput }}</pre>
          </div>

          <!-- Admin Commands -->
          <div class="output-block">
            <h3>
              Commandes RustFS Admin
              <button class="copy-btn" @click="copy('cmds')">
                {{ copied === 'cmds' ? 'Copié ✓' : 'Copier' }}
              </button>
            </h3>
            <pre>{{ cmdsOutput }}</pre>
          </div>

          <!-- Node.js Snippet -->
          <div class="output-block">
            <h3>
              Node.js Snippet
              <button class="copy-btn" @click="copy('node')">
                {{ copied === 'node' ? 'Copié ✓' : 'Copier' }}
              </button>
            </h3>
            <pre>{{ nodeOutput }}</pre>
          </div>
        </fieldset>
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

// ── Cases ──────────────────────────────────────────────────────────────────

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

// ── State ──────────────────────────────────────────────────────────────────

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

// ── Computed ───────────────────────────────────────────────────────────────

const currentCaseDef = computed(() => cases.find((c) => c.id === currentCase.value)!);

const needsCredentials = computed(() =>
  !['public-read', 'cloudfront-oac'].includes(currentCase.value),
);

const showGuardrails = computed(() =>
  !['cloudfront-oac'].includes(currentCase.value),
);

const availableGuardrails = computed(() =>
  guardrails.filter((g) => !g.conflictsWith?.includes(currentCase.value)),
);

const outputFormats = [
  { id: 'json' as const, label: 'JSON' },
  { id: 'terraform' as const, label: 'Terraform' },
  { id: 'cloudformation' as const, label: 'CloudFormation' },
  { id: 'cli' as const, label: 'CLI' },
];

const outputFormatLabel = computed(() =>
  outputFormats.find((f) => f.id === outputFormat.value)?.label ?? 'JSON',
);

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
    return {
      ...base,
      Statement: applyGuardrails(base.Statement, enabledGuardrails.value, config.value),
    };
  }
  return base;
});

const bucketPolicyJson = computed(() => JSON.stringify(bucketPolicy.value, null, 2));

const bucketPolicyOutput = computed(() => {
  switch (outputFormat.value) {
    case 'terraform':
      return toTerraform(bucketPolicy.value, config.value);
    case 'cloudformation':
      return toCloudFormation(bucketPolicy.value, config.value);
    case 'cli':
      return toCli(bucketPolicy.value, config.value);
    default:
      return bucketPolicyJson.value;
  }
});

const iamPolicyJson = computed(() => {
  const iam = buildIamPolicy(currentCase.value, config.value);
  return iam ? JSON.stringify(iam, null, 2) : null;
});

const envOutput = computed(() => buildEnv(currentCase.value, config.value));
const cmdsOutput = computed(() => buildCommands(currentCase.value, config.value));
const nodeOutput = computed(() => buildNode(currentCase.value, config.value));

// ── Actions ────────────────────────────────────────────────────────────────

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

<style scoped>
.app {
  padding: 24px;
}

h1 {
  color: #38bdf8;
  margin-bottom: 12px;
}

.case-desc {
  color: #94a3b8;
  font-size: 13px;
  margin: 0 0 16px;
}

.case-selector {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.case-selector button {
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.case-selector button.active {
  background: #38bdf8;
  color: #0f172a;
  border-color: #38bdf8;
}

.case-selector button:hover:not(.active) {
  background: #334155;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

fieldset {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 16px;
  background: #1e293b;
  margin-bottom: 16px;
}

legend {
  color: #38bdf8;
  padding: 0 8px;
  font-weight: 600;
}

label {
  display: block;
  margin: 10px 0 4px;
  font-size: 13px;
  color: #94a3b8;
}

input[type='text'],
input:not([type]) {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}

input:focus {
  outline: none;
  border-color: #38bdf8;
}

/* ── Guardrails ────────────────────────────────────────────── */

.guardrail-hint {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 8px;
}

.guardrail-item {
  margin-bottom: 10px;
}

.guardrail-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #e2e8f0;
  margin: 0;
}

.guardrail-label input[type='checkbox'] {
  margin-top: 3px;
  accent-color: #38bdf8;
}

.guardrail-label strong {
  display: block;
  color: #e2e8f0;
}

.guardrail-label small {
  display: block;
  color: #64748b;
  font-size: 11px;
  margin-top: 2px;
}

.guardrail-extra {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #334155;
}

/* ── Format tabs ───────────────────────────────────────────── */

.format-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.format-tabs button {
  background: #0f172a;
  color: #94a3b8;
  border: 1px solid #334155;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.format-tabs button.active {
  background: #4ade80;
  color: #0f172a;
  border-color: #4ade80;
}

.format-tabs button:hover:not(.active) {
  background: #1e293b;
}

/* ── Output ────────────────────────────────────────────────── */

pre {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.output-block {
  margin-bottom: 16px;
}

.output-block h3 {
  color: #4ade80;
  font-size: 13px;
  margin: 12px 0 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copy-btn {
  background: #334155;
  color: #e2e8f0;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}

.copy-btn:hover {
  background: #475569;
}
</style>
