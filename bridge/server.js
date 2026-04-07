import { createHmac, timingSafeEqual } from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const LINEAR_WEBHOOK_SECRET = process.env.LINEAR_WEBHOOK_SECRET;
const OPENCLAW_HOOK_URL = process.env.OPENCLAW_HOOK_URL;
const OPENCLAW_HOOK_TOKEN = process.env.OPENCLAW_HOOK_TOKEN;
const ALLOWED_TEAM_KEYS = (process.env.LINEAR_ALLOWED_TEAM_KEYS || 'KIR')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!LINEAR_WEBHOOK_SECRET) {
  throw new Error('LINEAR_WEBHOOK_SECRET is required');
}
if (!OPENCLAW_HOOK_URL) {
  throw new Error('OPENCLAW_HOOK_URL is required');
}
if (!OPENCLAW_HOOK_TOKEN) {
  throw new Error('OPENCLAW_HOOK_TOKEN is required');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      respondJson(res, 200, { ok: true });
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

    if (!shouldForward(payload)) {
      respondJson(res, 200, { ok: true, forwarded: false, reason: 'ignored' });
      return;
    }

    const forwardResponse = await fetch(OPENCLAW_HOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${OPENCLAW_HOOK_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await forwardResponse.text();

    if (!forwardResponse.ok) {
      respondJson(res, 502, {
        error: 'openclaw_forward_failed',
        status: forwardResponse.status,
        body: responseText,
      });
      return;
    }

    respondJson(res, 200, { ok: true, forwarded: true });
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

function shouldForward(payload) {
  const teamKey = payload?.data?.team?.key;
  const type = payload?.type;
  if (teamKey && !ALLOWED_TEAM_KEYS.includes(teamKey)) {
    return false;
  }

  return ['Issue', 'Comment', 'Project', 'ProjectUpdate'].includes(type);
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
