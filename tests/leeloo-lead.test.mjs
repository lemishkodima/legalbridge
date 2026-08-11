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
  process.env.LEELOO_TUNNEL_ID = 'tunnel-1';
  process.env.LEELOO_TUNNEL_BLOCK_ID = 'block-1';

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });

    if (url.includes('/people?')) {
      return new Response(JSON.stringify({ status: 1, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.endsWith('/people')) {
      return new Response(JSON.stringify({
        status: 1,
        data: { id: 'channel-1', person_id: 'person-1' }
      }), {
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
  assert.equal(calls.length, 4);

  const personBody = JSON.parse(calls[1].options.body);
  assert.deepEqual(personBody, {
    name: 'Олександр',
    phone: '+380735437441',
    leadgentool_id: 'test-leadgentool'
  });

  const commentBody = JSON.parse(calls[2].options.body);
  assert.match(commentBody.comment, /Потрібна консультація щодо ВЛК/);
  assert.equal(calls[2].options.method, 'PUT');
  assert.match(calls[2].url, /\/people\/person-1\/add-comment$/);

  const subscriptionBody = JSON.parse(calls[3].options.body);
  assert.equal(calls[3].options.method, 'POST');
  assert.match(calls[3].url, /\/communication-channels\/channel-1\/manual-subscribe$/);
  assert.deepEqual(subscriptionBody, {
    tunnel_id: 'tunnel-1',
    tunnel_block_id: 'block-1'
  });
});

test('reuses an existing person instead of creating a duplicate', async () => {
  process.env.LEELOO_API_TOKEN = 'test-token';
  process.env.LEELOO_LEADGENTOOL_ID = 'test-leadgentool';
  process.env.LEELOO_TUNNEL_ID = 'tunnel-1';
  process.env.LEELOO_TUNNEL_BLOCK_ID = 'block-1';

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });

    if (url.includes('/people?')) {
      return new Response(JSON.stringify({
        status: 1,
        data: [{ id: 'existing-person', phone: '+380735437441' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.endsWith('/people/existing-person')) {
      return new Response(JSON.stringify({
        status: 1,
        data: {
          id: 'existing-person',
          accounts: [{ account_id: 'existing-channel', from: 'MANUAL' }]
        }
      }), {
        status: 200,
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
        problem: 'Повторна заявка без дублювання картки.'
      }
    }, response);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.statusCode, 201);
  assert.equal(calls.length, 4);
  assert.equal(calls.some(call => call.url.endsWith('/people')), false);
  assert.match(calls[2].url, /\/people\/existing-person\/add-comment$/);
  assert.match(
    calls[3].url,
    /\/communication-channels\/existing-channel\/manual-subscribe$/
  );
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
