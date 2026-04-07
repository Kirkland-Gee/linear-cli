import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET;
const ALLOWED_TEAM_KEYS = (process.env.LINEAR_ALLOWED_TEAM_KEYS || 'KIR')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const EVENT_STORE_PATH = process.env.EVENT_STORE_PATH || '/tmp/linear-webhook-events.jsonl';
const BRIDGE_READ_TOKEN = process.env.BRIDGE_READ_TOKEN || '';

if (!LINEAR_WEBHOOK_SECRET) {
  throw new Error('LINEAR_WEBHOOK_SECRET is required');
}

fs.mkdirSync(path.dirname(EVENT_STORE_PATH), { recursive: true });

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      respondJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/events')) {
      if (!isReadAuthorized(req)) {
        respondJson(res, 401, { error: 'unauthorized' });
        return;
      }

      const limit = Math.max(1, Math.min(100, Number(new URL(req.url, 'http://localhost').searchParams.get('limit') || 20)));
      const events = readRecentEvents(limit);
      respondJson(res, 200, { ok: true, events });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/linear-webhook') {
      respondJson(res, 404, { error: 'not_found' });
      return;
    }

    const rawBody = await readRawBody(req);
    const signature = req.headers['linear-signature'];

    if (!verifyLinearSignature(rawBody, signature)) {
      respondJson(res, 401, { error: 'invalid_signature' });
      return;
    }

    const payload = JSON.parse(rawBody.toString('utf8'));

    if (!shouldStore(payload)) {
      respondJson(res, 200, { ok: true, stored: false, reason: 'ignored' });
      return;
    }

    const event = normalizeEvent(payload);
    fs.appendFileSync(EVENT_STORE_PATH, JSON.stringify(event) + '\n');

    respondJson(res, 200, { ok: true, stored: true, id: event.deliveryId });
  } catch (error) {
    respondJson(res, 500, {
      error: 'internal_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`linear webhook bridge listening on :${PORT}`);
});

function verifyLinearSignature(rawBody, signatureHeader) {
  if (!signatureHeader || Array.isArray(signatureHeader)) {
    return false;
  }

  const expected = createHmac('sha256', LINEAR_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signatureHeader, 'utf8');

  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function shouldStore(payload) {
  const teamKey = payload?.data?.team?.key;
  const type = payload?.type;
  if (teamKey && !ALLOWED_TEAM_KEYS.includes(teamKey)) {
    return false;
  }

  return ['Issue', 'Comment', 'Project', 'ProjectUpdate'].includes(type);
}

function normalizeEvent(payload) {
  return {
    deliveryId: payload.webhookId || payload.id || `${Date.now()}`,
    webhookTimestamp: payload.webhookTimestamp || Date.now(),
    type: payload.type || '',
    action: payload.action || '',
    url: payload.url || '',
    organizationId: payload.organizationId || '',
    title: payload?.data?.title || payload?.data?.body || '',
    identifier: payload?.data?.identifier || '',
    teamKey: payload?.data?.team?.key || '',
    projectName: payload?.data?.project?.name || '',
    stateName: payload?.data?.state?.name || '',
    assigneeName: payload?.data?.assignee?.name || '',
    payload,
  };
}

function readRecentEvents(limit) {
  if (!fs.existsSync(EVENT_STORE_PATH)) {
    return [];
  }

  const lines = fs.readFileSync(EVENT_STORE_PATH, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .slice(-limit);

  return lines.map((line) => JSON.parse(line));
}

function isReadAuthorized(req) {
  if (!BRIDGE_READ_TOKEN) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${BRIDGE_READ_TOKEN}`) {
    return true;
  }
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('token') === BRIDGE_READ_TOKEN;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function respondJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
