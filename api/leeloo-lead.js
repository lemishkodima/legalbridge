const LEELOO_API_BASE_URL = 'https://api.leeloo.ai/api/v2';
const REQUEST_TIMEOUT_MS = 10_000;

function sendJson(response, statusCode, payload) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(statusCode).json(payload);
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+38${digits}`;
  if (raw.startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;

  return '';
}

function validateLead(body) {
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(body?.phone);
  const problem = String(body?.problem || '').trim().replace(/\r\n/g, '\n');

  if (name.length < 2 || name.length > 100) {
    return { error: 'Вкажіть коректне імʼя.' };
  }

  if (!phone) {
    return { error: 'Вкажіть коректний номер телефону.' };
  }

  if (problem.length < 5 || problem.length > 1_500) {
    return { error: 'Коротко опишіть проблему — від 5 до 1500 символів.' };
  }

  return { lead: { name, phone, problem } };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function leelooRequest(path, { token, method = 'GET', body }) {
  const response = await fetchWithTimeout(`${LEELOO_API_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Leeloo-AuthToken': token
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  return { ok: response.ok && payload.status !== 0, status: response.status, payload };
}

function getCreatedPersonIdentifiers(payload) {
  // Leeloo returns both identifiers when a MANUAL communication channel is
  // created: data.id is the channel ID and data.person_id is the CRM person ID.
  const personId = payload?.data?.person_id
    || payload?.data?.person?.id
    || payload?.person?.id
    || payload?.data?.id
    || '';
  const accountId = payload?.data?.account_id
    || payload?.data?.account?.id
    || (payload?.data?.person_id ? payload?.data?.id : '')
    || '';

  return { personId, accountId };
}

async function getPersonIdentifiers(token, personId) {
  const result = await leelooRequest(`/people/${encodeURIComponent(personId)}`, { token });

  if (!result.ok) return { personId, accountId: '' };

  const accounts = Array.isArray(result.payload?.data?.accounts)
    ? result.payload.data.accounts
    : [];
  const account = accounts.find(item => item.from === 'MANUAL') || accounts[0];

  return { personId, accountId: account?.account_id || '' };
}

async function findPersonByPhone(token, phone) {
  const params = new URLSearchParams({
    limit: '20',
    offset: '0',
    'filter[phone]': phone
  });
  const result = await leelooRequest(`/people?${params}`, { token });

  if (!result.ok || !Array.isArray(result.payload?.data)) return '';

  return result.payload.data.find(person => normalizePhone(person.phone) === phone)?.id || '';
}

async function createOrFindPerson({ token, leadgentoolId, lead }) {
  const existingPersonId = await findPersonByPhone(token, lead.phone);

  if (existingPersonId) return getPersonIdentifiers(token, existingPersonId);

  const personBody = {
    name: lead.name,
    phone: lead.phone,
    ...(leadgentoolId ? { leadgentool_id: leadgentoolId } : {})
  };
  const creation = await leelooRequest('/people', {
    token,
    method: 'POST',
    body: personBody
  });
  const createdPerson = getCreatedPersonIdentifiers(creation.payload);

  if (creation.ok && createdPerson.personId) return createdPerson;

  // A second lookup covers a concurrent request that created the person first.
  const concurrentlyCreatedPersonId = await findPersonByPhone(token, lead.phone);

  if (concurrentlyCreatedPersonId) {
    return getPersonIdentifiers(token, concurrentlyCreatedPersonId);
  }

  const error = new Error('person_creation_failed');
  error.upstreamStatus = creation.status;
  throw error;
}

async function subscribeToTunnelBlock({ token, accountId, tunnelId, tunnelBlockId }) {
  if (!tunnelId && !tunnelBlockId) return;

  if (!tunnelId || !tunnelBlockId || !accountId) {
    throw new Error('tunnel_subscription_not_configured');
  }

  const result = await leelooRequest(
    `/communication-channels/${encodeURIComponent(accountId)}/manual-subscribe`,
    {
      token,
      method: 'POST',
      body: {
        tunnel_id: tunnelId,
        tunnel_block_id: tunnelBlockId
      }
    }
  );

  if (!result.ok) {
    const error = new Error('tunnel_subscription_failed');
    error.upstreamStatus = result.status;
    throw error;
  }
}

async function addProblemComment({ token, personId, problem }) {
  const comment = [
    'Заявка з сайту Legal Bridge Service',
    '',
    'Короткий опис проблеми:',
    problem
  ].join('\n');
  const request = () => leelooRequest(`/people/${encodeURIComponent(personId)}/add-comment`, {
    token,
    method: 'PUT',
    body: { comment }
  });

  let result = await request();

  if (!result.ok) result = await request();
  if (!result.ok) {
    const error = new Error('comment_creation_failed');
    error.upstreamStatus = result.status;
    throw error;
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { ok: false, message: 'Метод не підтримується.' });
  }

  if (request.body?.website) {
    return sendJson(response, 200, { ok: true });
  }

  const validation = validateLead(request.body);

  if (validation.error) {
    return sendJson(response, 422, { ok: false, message: validation.error });
  }

  const token = process.env.LEELOO_API_TOKEN?.trim();
  const leadgentoolId = process.env.LEELOO_LEADGENTOOL_ID?.trim();
  const tunnelId = process.env.LEELOO_TUNNEL_ID?.trim();
  const tunnelBlockId = process.env.LEELOO_TUNNEL_BLOCK_ID?.trim();

  if (!token) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Інтеграція тимчасово не налаштована.'
    });
  }

  try {
    const person = await createOrFindPerson({
      token,
      leadgentoolId,
      lead: validation.lead
    });

    await addProblemComment({
      token,
      personId: person.personId,
      problem: validation.lead.problem
    });

    await subscribeToTunnelBlock({
      token,
      accountId: person.accountId,
      tunnelId,
      tunnelBlockId
    });

    return sendJson(response, 201, { ok: true });
  } catch (error) {
    console.error('Leeloo lead delivery failed', {
      stage: error?.message || 'unknown_error',
      upstreamStatus: error?.upstreamStatus || null
    });

    return sendJson(response, 502, {
      ok: false,
      message: 'Не вдалося передати заявку. Спробуйте ще раз або зателефонуйте нам.'
    });
  }
}
