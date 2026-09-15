import type { PolicyStatement, PolicyConfig } from './policy';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Guardrail {
  id: string;
  label: string;
  description: string;
  /** Guardrails that conflict with this one */
  conflictsWith?: string[];
  build: (config: PolicyConfig) => PolicyStatement;
}

// ── Guardrails catalog ─────────────────────────────────────────────────────

export const guardrails: Guardrail[] = [
  {
    id: 'deny-insecure-transport',
    label: 'Exiger HTTPS (deny insecure transport)',
    description:
      'Deny toute requête non chiffrée (HTTP) vers le bucket. Standard de sécurité minimal.',
    build: (config) => ({
      Sid: 'DenyInsecureTransport',
      Effect: 'Deny',
      Principal: '*',
      Action: 's3:*',
      Resource: [`arn:aws:s3:::${config.bucket}`, `arn:aws:s3:::${config.bucket}/*`],
      Condition: {
        Bool: { 'aws:SecureTransport': 'false' },
      },
    }),
  },
  {
    id: 'enforce-sse',
    label: 'Exiger chiffrement SSE (encryption at rest)',
    description:
      "Reject les uploads sans header d'encryption. Protège contre les objets stockés en clair.",
    build: (config) => ({
      Sid: 'DenyUnencryptedUploads',
      Effect: 'Deny',
      Principal: '*',
      Action: 's3:PutObject',
      Resource: [`arn:aws:s3:::${config.bucket}/*`],
      Condition: {
        StringNotEquals: {
          's3:x-amz-server-side-encryption': 'aws:kms',
        },
      },
    }),
  },
  {
    id: 'vpc-endpoint',
    label: 'Restreindre à un VPC Endpoint',
    description:
      "N'autorise les accès que depuis un VPC endpoint spécifique. Empêche l'accès depuis Internet.",
    conflictsWith: ['cloudfront-oac'],
    build: (config) => ({
      Sid: 'DenyNonVPCEndpoint',
      Effect: 'Deny',
      Principal: '*',
      Action: 's3:*',
      Resource: [`arn:aws:s3:::${config.bucket}`, `arn:aws:s3:::${config.bucket}/*`],
      Condition: {
        StringNotEquals: {
          'aws:sourceVpce': config.vpcEndpointId || 'vpce-xxxxxxxx',
        },
      },
    }),
  },
  {
    id: 'org-restriction',
    label: "Restreindre à une Organization AWS",
    description:
      "N'autorise l'accès qu'aux comptes membres d'une organization donnée.",
    build: (config) => ({
      Sid: 'DenyNonOrgAccess',
      Effect: 'Deny',
      Principal: '*',
      Action: 's3:*',
      Resource: [`arn:aws:s3:::${config.bucket}`, `arn:aws:s3:::${config.bucket}/*`],
      Condition: {
        StringNotEquals: {
          'aws:PrincipalOrgID': config.organizationId || 'o-xxxxxxxxxx',
        },
      },
    }),
  },
];

// ── Apply guardrails to a policy ───────────────────────────────────────────

export function applyGuardrails(
  statements: PolicyStatement[],
  enabledIds: string[],
  config: PolicyConfig,
): PolicyStatement[] {
  const enabled = guardrails.filter((g) => enabledIds.includes(g.id));
  const guardrailStatements = enabled.map((g) => g.build(config));
  return [...statements, ...guardrailStatements];
}
