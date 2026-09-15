import type { BucketPolicy, PolicyConfig, CaseId } from './policy';

// ── Terraform ──────────────────────────────────────────────────────────────

export function toTerraform(
  policy: BucketPolicy,
  config: PolicyConfig,
): string {
  const statements = policy.Statement.map((s) => {
    const lines: string[] = ['    {'];
    lines.push(`      Sid       = "${s.Sid}"`);
    lines.push(`      Effect    = "${s.Effect}"`);

    // Principal
    if (s.Principal === '*') {
      lines.push('      Principal = "*"');
    } else if (typeof s.Principal === 'object') {
      const entries = Object.entries(s.Principal);
      if (entries.length === 1) {
        const [key, val] = entries[0];
        if (Array.isArray(val)) {
          lines.push(`      Principal = { ${key} = ${ JSON.stringify(val) } }`);
        } else {
          lines.push(`      Principal = { ${key} = "${val}" }`);
        }
      } else {
        lines.push('      Principal = {');
        for (const [key, val] of entries) {
          lines.push(`        ${key} = ${Array.isArray(val) ? JSON.stringify(val) : `"${val}"`}`);
        }
        lines.push('      }');
      }
    }

    // Actions
    if (s.Action.length === 1) {
      lines.push(`      actions   = ["${s.Action[0]}"]`);
    } else {
      lines.push(`      actions   = ${JSON.stringify(s.Action)}`);
    }

    // Resources
    lines.push(`      resources = ${JSON.stringify(s.Resource)}`);

    // Condition
    if (s.Condition) {
      lines.push('      conditions = [{');
      for (const [test, values] of Object.entries(s.Condition)) {
        for (const [key, val] of Object.entries(values)) {
          lines.push(`        test     = "${test}"`);
          lines.push(`        variable = "${key}"`);
          lines.push(`        values   = ${Array.isArray(val) ? JSON.stringify(val) : `["${val}"]`}`);
        }
      }
      lines.push('      }]');
    }

    lines.push('    }');
    return lines.join('\n');
  });

  return `resource "aws_s3_bucket_policy" "${config.bucket.replace(/-/g, '_')}" {
  bucket = aws_s3_bucket.${config.bucket.replace(/-/g, '_')}.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
${statements.join(',\n')}
    ]
  })
}`;
}

// ── CloudFormation ─────────────────────────────────────────────────────────

export function toCloudFormation(
  policy: BucketPolicy,
  config: PolicyConfig,
): string {
  const logicalName = config.bucket.replace(/[^a-zA-Z0-9]/g, '');

  const statements = policy.Statement.map((s) => {
    const lines: string[] = ['        {'];

    lines.push(`          Sid: "${s.Sid}"`);
    lines.push(`          Effect: "${s.Effect}"`);

    // Principal
    if (s.Principal === '*') {
      lines.push('          Principal: "*"');
    } else if (typeof s.Principal === 'object') {
      const entries = Object.entries(s.Principal);
      if (entries.length === 1) {
        const [key, val] = entries[0];
        if (Array.isArray(val)) {
          lines.push(`          Principal:`);
          lines.push(`            ${key}: ${val.map((v) => `"${v}"`).join(', ')}`);
        } else {
          lines.push(`          Principal:`);
          lines.push(`            ${key}: "${val}"`);
        }
      } else {
        lines.push('          Principal:');
        for (const [key, val] of entries) {
          lines.push(`            ${key}: ${Array.isArray(val) ? val.map((v) => `"${v}"`).join(', ') : `"${val}"`}`);
        }
      }
    }

    // Actions
    if (s.Action.length === 1) {
      lines.push(`          Action: "${s.Action[0]}"`);
    } else {
      lines.push('          Action:');
      for (const a of s.Action) {
        lines.push(`            - "${a}"`);
      }
    }

    // Resources
    lines.push('          Resource:');
    for (const r of s.Resource) {
      lines.push(`            - "${r}"`);
    }

    // Condition
    if (s.Condition) {
      lines.push('          Condition:');
      for (const [test, values] of Object.entries(s.Condition)) {
        lines.push(`            ${test}:`);
        for (const [key, val] of Object.entries(values)) {
          if (Array.isArray(val)) {
            lines.push(`              ${key}: ${val.map((v) => `"${v}"`).join(', ')}`);
          } else {
            lines.push(`              ${key}: "${val}"`);
          }
        }
      }
    }

    lines.push('        }');
    return lines.join('\n');
  });

  return `Resources:
  ${logicalName}BucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref ${logicalName}
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
${statements.join('\n')}`;
}

// ── AWS CLI ────────────────────────────────────────────────────────────────

export function toCli(
  policy: BucketPolicy,
  config: PolicyConfig,
): string {
  const policyJson = JSON.stringify(policy, null, 2);
  return `# Sauvegarder la policy
cat > /tmp/bucket-policy.json <<'EOF'
${policyJson}
EOF

# Appliquer
aws s3api put-bucket-policy \\
  --bucket ${config.bucket} \\
  --policy file:///tmp/bucket-policy.json \\
  --endpoint-url ${config.endpoint}`;
}
