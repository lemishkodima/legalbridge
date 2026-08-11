import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/leeloo-lead.js';

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('creates a person and adds the problem as a comment', async () => {
  process.env.LEELOO_API_TOKEN = 'test-token';
  process.env.LEELOO_LEADGENTOOL_ID = 'test-leadgentool';

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/people')) {
      return new Response(JSON.stringify({ status: 1, data: { id: 'person-1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ status: 1, data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const response = createResponse();

  try {
    await handler({
      method: 'POST',
      body: {
        name: 'Олександр',
        phone: '073 543 74 41',
        problem: 'Потрібна консультація щодо ВЛК.'
      }
    }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(calls.length, 2);

  const personBody = JSON.parse(calls[0].options.body);
  assert.deepEqual(personBody, {
    name: 'Олександр',
    phone: '+380735437441',
    leadgentool_id: 'test-leadgentool'
  });

  const commentBody = JSON.parse(calls[1].options.body);
  assert.match(commentBody.comment, /Потрібна консультація щодо ВЛК/);
  assert.equal(calls[1].options.method, 'PUT');
});

test('rejects invalid form data before calling Leeloo', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called');
  };
  const response = createResponse();

  try {
    await handler({
      method: 'POST',
      body: { name: 'A', phone: '123', problem: 'x' }
    }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 422);
  assert.equal(response.payload.ok, false);
});

test('silently accepts honeypot submissions', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called');
  };
  const response = createResponse();

  try {
    await handler({ method: 'POST', body: { website: 'spam' } }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
});
