// ── AWS Signature V4 (minimal, browser-compatible) ──────────────────────────

function sha256(data: ArrayBuffer | ArrayBufferView | string): Promise<string> {
  const buf = data instanceof ArrayBuffer
    ? data
    : data instanceof ArrayBufferView
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new TextEncoder().encode(data);
  return crypto.subtle.digest('SHA-256', buf).then((hash) =>
    Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join(''),
  );
}

function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((k) => crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}

async function deriveSigningKey(secretKey: string, date: string, region: string, service: string) {
  const kDate = await hmacSha256(new TextEncoder().encode(secretKey), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function toAmzDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  prefix: string;
}

export interface TestResult {
  ok: boolean;
  status?: number;
  message: string;
  details?: string;
  url?: string;
}

// ── Build a signed S3 request ──────────────────────────────────────────────

async function signedRequest(
  config: S3Config,
  method: string,
  key: string,
  body?: ArrayBuffer | Uint8Array,
  contentType?: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = formatDate(now);
  const service = 's3';

  const ep = config.endpoint.replace(/\/$/, '');
  const url = new URL(`/${config.bucket}/${key}`, ep);
  const host = url.host;
  const path = url.pathname;

  const payloadHash = body ? await sha256(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  if (contentType) headers['content-type'] = contentType;
  if (method === 'PUT' && body) headers['content-length'] = String(body.byteLength);

  const signedHeaders = Object.keys(headers).sort().join('\n');
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}`).join('\n') + '\n';

  const canonicalRequest = [
    method,
    path,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(config.secretKey, dateStamp, region, service);
  const signature = Array.from(
    new Uint8Array(await hmacSha256(signingKey, stringToSign)),
  ).map((b) => b.toString(16).padStart(2, '0')).join('');

  headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: url.toString(), headers };
}

// ── Test functions ─────────────────────────────────────────────────────────

export async function testList(config: S3Config): Promise<TestResult> {
  try {
    const prefix = config.prefix.replace(/\/$/, '') + '/';
    const { url, headers } = await signedRequest(config, 'GET', `?prefix=${encodeURIComponent(prefix)}&max-keys=5`);
    const res = await fetch(url, { headers });

    if (res.ok) {
      const text = await res.text();
      const count = (text.match(/<Key>/g) || []).length;
      return { ok: true, status: res.status, message: `ListBucket OK — ${count} objet(s) trouvé(s)` };
    }

    const body = await res.text();
    const msg = body.match(/<Message>(.*?)<\/Message>/)?.[1] || res.statusText;
    return { ok: false, status: res.status, message: `ListBucket échoué — ${msg}`, details: body.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, message: `Erreur réseau — ${e.message}` };
  }
}

export async function testRead(config: S3Config, testKey: string): Promise<TestResult> {
  try {
    const { url, headers } = await signedRequest(config, 'GET', testKey);
    const res = await fetch(url, { headers });

    if (res.ok) {
      return { ok: true, status: res.status, message: `GetObject OK — ${res.headers.get('content-type')}`, url };
    }

    if (res.status === 404) {
      return { ok: false, status: 404, message: "Objet introuvable (404) — l'objet test n'existe pas encore, créez-le d'abord" };
    }

    const body = await res.text();
    const msg = body.match(/<Message>(.*?)<\/Message>/)?.[1] || res.statusText;
    return { ok: false, status: res.status, message: `GetObject échoué — ${msg}`, details: body.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, message: `Erreur réseau — ${e.message}` };
  }
}

export async function testWrite(
  config: S3Config,
  file: File,
): Promise<TestResult & { publicUrl?: string }> {
  try {
    const key = `${config.prefix.replace(/\/$/, '')}/${file.name}`;
    const buf = await file.arrayBuffer();
    const { url, headers } = await signedRequest(config, 'PUT', key, new Uint8Array(buf), file.type || 'application/octet-stream');
    const res = await fetch(url, { method: 'PUT', headers, body: buf });

    if (res.ok) {
      const publicUrl = `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${key}`;
      return { ok: true, status: res.status, message: `PutObject OK — ${file.name} uploadé`, publicUrl };
    }

    const body = await res.text();
    const msg = body.match(/<Message>(.*?)<\/Message>/)?.[1] || res.statusText;
    return { ok: false, status: res.status, message: `PutObject échoué — ${msg}`, details: body.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, message: `Erreur réseau — ${e.message}` };
  }
}

export async function testPublicRead(publicUrl: string): Promise<TestResult> {
  try {
    const res = await fetch(publicUrl);
    if (res.ok) {
      const ct = res.headers.get('content-type');
      return { ok: true, status: res.status, message: `Lecture publique OK — ${ct}`, url: publicUrl };
    }
    return { ok: false, status: res.status, message: `Lecture publique échouée — HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, message: `Erreur réseau — ${e.message}` };
  }
}

export async function testDelete(config: S3Config, key: string): Promise<TestResult> {
  try {
    const { url, headers } = await signedRequest(config, 'DELETE', key);
    const res = await fetch(url, { method: 'DELETE', headers });

    if (res.ok || res.status === 204) {
      return { ok: true, status: res.status, message: 'DeleteObject OK' };
    }

    const body = await res.text();
    const msg = body.match(/<Message>(.*?)<\/Message>/)?.[1] || res.statusText;
    return { ok: false, status: res.status, message: `DeleteObject échoué — ${msg}`, details: body.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, message: `Erreur réseau — ${e.message}` };
  }
}
