import { createServer } from 'node:http';

export type StartedUpstreamStub = {
  close: () => Promise<void>;
  url: string;
};

export async function startManagementUpstreamStub(status = 'ok'): Promise<StartedUpstreamStub> {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status }));
      return;
    }

    if (request.method === 'GET' && request.url === '/config') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { version: '1.0.16' } }));
      return;
    }

    if (request.method === 'GET' && request.url === '/public-config') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          success: true,
          data: { betterAuth: false, permissions: [], skipAuth: false },
        }),
      );
      return;
    }

    if (request.method === 'GET' && request.url === '/api/auth/user') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ success: true, user: { isAdmin: true, username: 'stub-admin' } }),
      );
      return;
    }

    if (request.method === 'GET' && request.url === '/api/logs') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{ level: 'info', message: `${status}-log-line` }]));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/settings') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ mode: status, token: 'secret-token' }));
      return;
    }

    if (request.method === 'GET' && request.url === '/api/servers') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([]));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'not found' }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to resolve upstream stub address.');
  }

  return {
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    url: `http://127.0.0.1:${String(address.port)}`,
  };
}
