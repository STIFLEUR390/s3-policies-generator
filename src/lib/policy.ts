// ── Types ──────────────────────────────────────────────────────────────────

export interface PolicyStatement {
  Sid: string;
  Effect: 'Allow' | 'Deny';
  Principal: string | Record<string, string | string[]>;
  Action: string[];
  Resource: string[];
  Condition?: Record<string, Record<string, string | string[]>>;
}

export interface BucketPolicy {
  Version: string;
  Statement: PolicyStatement[];
}

export type CaseId =
  | 'private'
  | 'public-read'
  | 'public-write'
  | 'cloudfront-oac'
  | 'cross-account'
  | 'deny-insecure'
  | 'ip-restriction'
  | 'mfa-required';

export interface CaseDef {
  id: CaseId;
  label: string;
  category: 'preset' | 'advanced';
  description?: string;
}

export interface PolicyConfig {
  bucket: string;
  prefix: string;
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  // Advanced cases
  cloudfrontDistributionId?: string;
  crossAccountAccountId?: string;
  allowedIpCidr?: string;
  vpcEndpointId?: string;
  organizationId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function arn(bucket: string, prefix?: string): string {
  const p = prefix?.replace(/\/$/, '');
  return p ? `arn:aws:s3:::${bucket}/${p}*` : `arn:aws:s3:::${bucket}/*`;
}

function bucketArn(bucket: string): string {
  return `arn:aws:s3:::${bucket}`;
}

function cleanPrefix(p: string): string {
  return p.replace(/\/$/, '') + '/';
}

// ── Bucket Policy ──────────────────────────────────────────────────────────

export function buildBucketPolicy(
  caseId: CaseId,
  config: PolicyConfig,
): BucketPolicy {
  const b = config.bucket;
  const p = cleanPrefix(config.prefix);

  switch (caseId) {
    case 'private':
      // RustFS: bucket is private by default (no policy = no anonymous access).
      // Explicit Deny for unauthenticated requests is not possible because
      // aws:PrincipalType is an AWS IAM condition key not supported by RustFS.
      // Access control relies entirely on IAM credentials.
      return {
        Version: '2012-10-17',
        Statement: [],
      };

    case 'public-read':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadOnly',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [arn(b, p)],
          },
          {
            Sid: 'DenyWritesAndListing',
            Effect: 'Deny',
            Principal: '*',
            Action: ['s3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
            Resource: [bucketArn(b), arn(b)],
          },
        ],
      };

    case 'public-write':
      // RustFS: Allow public read + authenticated write.
      // The Deny with aws:PrincipalType is not supported by RustFS.
      // Write access is enforced via IAM policy (upload-only).
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [arn(b, p)],
          },
        ],
      };

    case 'cloudfront-oac':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowCloudFrontOAC',
            Effect: 'Allow',
            Principal: {
              Service: 'cloudfront.amazonaws.com',
            },
            Action: 's3:GetObject',
            Resource: [arn(b, p)],
            Condition: {
              StringEquals: {
                'AWS:SourceArn': `arn:aws:cloudfront::${config.region}:distribution/${config.cloudfrontDistributionId || 'DIST_ID'}`,
              },
            },
          },
        ],
      };

    case 'cross-account':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'CrossAccountAccess',
            Effect: 'Allow',
            Principal: {
              AWS: `arn:aws:iam::${config.crossAccountAccountId || '123456789012'}:root`,
            },
            Action: ['s3:GetObject', 's3:ListBucket'],
            Resource: [bucketArn(b), arn(b, p)],
          },
        ],
      };

    case 'deny-insecure':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureTransport',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [bucketArn(b), arn(b)],
            Condition: {
              Bool: { 'aws:SecureTransport': 'false' },
            },
          },
        ],
      };

    case 'ip-restriction':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'RestrictToIP',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
            Resource: [bucketArn(b), arn(b, p)],
            Condition: {
             IpAddress: { 'aws:SourceIp': config.allowedIpCidr || '203.0.113.0/24' },
            },
          },
        ],
      };

    case 'mfa-required':
      return {
        Version: '2012-10-17',
        Statement: [
          {
            // Note: aws:MultiFactorAuthPresent is an AWS IAM condition key.
            // RustFS does not support this condition. MFA enforcement
            // must be handled at the application or proxy layer.
            Sid: 'WriteOnly',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:PutObject'],
            Resource: [arn(b, p)],
          },
        ],
      };
  }
}

// ── IAM Policy ─────────────────────────────────────────────────────────────

export function buildIamPolicy(
  caseId: CaseId,
  config: PolicyConfig,
): BucketPolicy | null {
  const b = config.bucket;
  const p = cleanPrefix(config.prefix);

  if (caseId === 'private') {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'ListBucketPrivate',
          Effect: 'Allow',
          Action: ['s3:ListBucket', 's3:GetBucketLocation'],
          Resource: [bucketArn(b)],
          Condition: {
            StringLike: { 's3:prefix': [`${p}*`] },
          },
        },
        {
          Sid: 'ReadWritePrivate',
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          Resource: [arn(b, p)],
        },
      ],
    };
  }

  if (caseId === 'public-write' || caseId === 'cross-account') {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'UploadOnly',
          Effect: 'Allow',
          Action: ['s3:PutObject'],
          Resource: [arn(b, p)],
        },
        {
          Sid: 'ListOwnUploads',
          Effect: 'Allow',
          Action: ['s3:ListBucket'],
          Resource: [bucketArn(b)],
          Condition: {
            StringLike: { 's3:prefix': [`${p}*`] },
          },
        },
      ],
    };
  }

  return null;
}

// ── .env ───────────────────────────────────────────────────────────────────

export function buildEnv(
  caseId: CaseId,
  config: PolicyConfig,
): string {
  const p = cleanPrefix(config.prefix);
  const ep = config.endpoint;
  const rg = config.region;
  const b = config.bucket;

  const lines = [
    `RUSTFS_ENDPOINT=${ep}`,
    `RUSTFS_REGION=${rg}`,
    `RUSTFS_BUCKET=${b}`,
    `RUSTFS_PREFIX=${p}`,
  ];

  const needsCredentials = caseId !== 'public-read' && caseId !== 'cloudfront-oac';
  const needsPublicUrl =
    caseId === 'public-read' ||
    caseId === 'public-write' ||
    caseId === 'cloudfront-oac';

  if (needsCredentials) {
    lines.push(`RUSTFS_ACCESS_KEY=${config.accessKey}`);
    lines.push(`RUSTFS_SECRET_KEY=${config.secretKey}`);
  }

  if (needsPublicUrl) {
    lines.push(`RUSTFS_PUBLIC_URL=${ep}/${b}/${p}`);
  }

  return lines.join('\n');
}

// ── Admin Commands ─────────────────────────────────────────────────────────

export function buildCommands(
  caseId: CaseId,
  config: PolicyConfig,
): string {
  const b = config.bucket;
  const ep = config.endpoint;
  const ak = config.accessKey;
  const sk = config.secretKey;
  const iam = buildIamPolicy(caseId, config);
  const policyName =
    caseId === 'private' ? 'private-policy' : 'uploader-policy';
  const bucketPolicy = buildBucketPolicy(caseId, config);

  const parts: string[] = [];

  parts.push(`# 1) Appliquer la bucket policy`);
  parts.push(
    `cat > /tmp/bucket-policy.json <<'EOF'\n${JSON.stringify(bucketPolicy, null, 2)}\nEOF`,
  );
  parts.push(
    `aws s3api put-bucket-policy --bucket ${b} \\\n  --policy file:///tmp/bucket-policy.json \\\n  --endpoint-url ${ep}`,
  );

  if (iam) {
    parts.push(`\n# 2) Créer l'utilisateur IAM`);
    parts.push(
      `curl -X PUT "${ep}/rustfs/admin/v3/add-user?accessKey=${ak}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"secretKey": "${sk}", "status": "enabled"}'`,
    );

    parts.push(`\n# 3) Créer la politique IAM`);
    parts.push(
      `cat > /tmp/iam-policy.json <<'EOF'\n${JSON.stringify(iam, null, 2)}\nEOF`,
    );
    parts.push(
      `curl -X PUT "${ep}/rustfs/admin/v3/add-canned-policy?name=${policyName}" \\\n  -H "Content-Type: application/json" \\\n  --data-binary @/tmp/iam-policy.json`,
    );

    parts.push(`\n# 4) Attacher la politique à l'utilisateur`);
    parts.push(
      `curl -X PUT "${ep}/rustfs/admin/v3/set-user-or-group-policy?policyName=${policyName}&userOrGroup=${ak}&isGroup=false"`,
    );
  }

  return parts.join('\n');
}

// ── Node.js Snippet ────────────────────────────────────────────────────────

export function buildNode(
  caseId: CaseId,
  config: PolicyConfig,
): string {
  const envLines = buildEnv(caseId, config)
    .split('\n')
    .filter(Boolean)
    .map((l) => `// ${l}`)
    .join('\n');
  const b = 'process.env.RUSTFS_BUCKET';
  const p = 'process.env.RUSTFS_PREFIX';

  const parts: string[] = [envLines, ''];

  parts.push(
    'import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";',
  );
  parts.push('import { getSignedUrl } from "@aws-sdk/s3-request-presigner";');
  parts.push('import { Readable } from "node:stream";');
  parts.push('');

  if (caseId === 'public-read' || caseId === 'cloudfront-oac') {
    parts.push('// Lecture publique — pas de credentials requis');
    parts.push('const baseUrl = process.env.RUSTFS_PUBLIC_URL;');
    parts.push('const publicUrl = (key) => `${baseUrl}${key}`;');
    parts.push('');
    parts.push('// Télécharger un objet public');
    parts.push('const res = await fetch(publicUrl("logo.png"));');
    parts.push('const buf = Buffer.from(await res.arrayBuffer());');
  } else {
    parts.push('const s3 = new S3Client({');
    parts.push('  endpoint: process.env.RUSTFS_ENDPOINT,');
    parts.push('  region: process.env.RUSTFS_REGION,');
    parts.push('  credentials: {');
    parts.push('    accessKeyId: process.env.RUSTFS_ACCESS_KEY,');
    parts.push('    secretAccessKey: process.env.RUSTFS_SECRET_KEY,');
    parts.push('  },');
    parts.push('  forcePathStyle: true, // OBLIGATOIRE avec RustFS');
    parts.push('});');
    parts.push('');
    parts.push('// Upload');
    parts.push(
      'async function upload(key, body, contentType = "application/octet-stream") {',
    );
    parts.push(`  const fullKey = \`\${${p}}\${key}\`;`);
    parts.push('  await s3.send(new PutObjectCommand({');
    parts.push(
      `    Bucket: ${b}, Key: fullKey, Body: body, ContentType: contentType,`,
    );
    parts.push('  }));');
    parts.push('  return fullKey;');
    parts.push('}');
    parts.push('');

    if (caseId === 'private') {
      parts.push('// Télécharger (privé)');
      parts.push('async function download(key) {');
      parts.push(`  const fullKey = \`\${${p}}\${key}\`;`);
      parts.push('  const { Body } = await s3.send(new GetObjectCommand({');
      parts.push(`    Bucket: ${b}, Key: fullKey,`);
      parts.push('  }));');
      parts.push('  return Readable.from(Body);');
      parts.push('}');
      parts.push('');
      parts.push('// URL signée (partage temporaire)');
      parts.push('async function signedUrl(key, expiresIn = 3600) {');
      parts.push(`  const fullKey = \`\${${p}}\${key}\`;`);
      parts.push('  return getSignedUrl(s3, new GetObjectCommand({');
      parts.push(`    Bucket: ${b}, Key: fullKey,`);
      parts.push('  }), { expiresIn });');
      parts.push('}');
      parts.push('');
      parts.push('// Démo');
      parts.push('await upload("doc.pdf", Buffer.from("hello"));');
      parts.push('console.log(await signedUrl("doc.pdf"));');
    } else {
      parts.push('// Liste des uploads');
      parts.push('async function listUploads() {');
      parts.push('  const { Contents } = await s3.send(new ListObjectsV2Command({');
      parts.push(`    Bucket: ${b}, Prefix: ${p},`);
      parts.push('  }));');
      parts.push('  return (Contents || []).map(o => ({');
      parts.push('    key: o.Key,');
      parts.push(
        `    url: \`\${process.env.RUSTFS_PUBLIC_URL}\${o.Key.replace(${p}, "")}\`,`,
      );
      parts.push('  }));');
      parts.push('}');
      parts.push('');
      parts.push('// Démo');
      parts.push(
        'const key = await upload("photo.jpg", Buffer.from("fake"), "image/jpeg");',
      );
      parts.push(
        'console.log("URL publique :", `${process.env.RUSTFS_PUBLIC_URL}${key.replace(process.env.RUSTFS_PREFIX, "")}`);',
      );
      parts.push('console.log(await listUploads());');
    }
  }

  return parts.join('\n');
}
