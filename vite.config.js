import { defineConfig, loadEnv } from 'vite';

import leelooLeadHandler from './api/leeloo-lead.js';

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', chunk => {
      body += chunk;

      if (body.length > 20_000) {
        reject(new Error('request_too_large'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });

    request.on('error', reject);
  });
}

function createResponseAdapter(response) {
  let statusCode = 200;

  return {
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      response.statusCode = statusCode;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(payload));
      return this;
    }
  };
}

function leelooApiDevPlugin() {
  return {
    name: 'leeloo-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/leeloo-lead', async (request, response) => {
        try {
          request.body = request.method === 'POST' ? await readJsonBody(request) : {};
          await leelooLeadHandler(request, createResponseAdapter(response));
        } catch {
          response.statusCode = 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(JSON.stringify({ ok: false, message: 'Некоректний запит.' }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'LEELOO_');

  process.env.LEELOO_API_TOKEN = env.LEELOO_API_TOKEN;
  process.env.LEELOO_LEADGENTOOL_ID = env.LEELOO_LEADGENTOOL_ID;
  process.env.LEELOO_TUNNEL_ID = env.LEELOO_TUNNEL_ID;
  process.env.LEELOO_TUNNEL_BLOCK_ID = env.LEELOO_TUNNEL_BLOCK_ID;

  return {
    plugins: [leelooApiDevPlugin()]
  };
});
