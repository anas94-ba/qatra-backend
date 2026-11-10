import { createDocsAuth, credentialsMatch, docsCredentials, parseBasicAuth } from './swagger-auth';

const expected = { user: 'qatra-docs', password: 'a-long:secret' };
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

function run(middleware: ReturnType<typeof createDocsAuth>, path: string, authorization?: string, ip = '1.1.1.1') {
  const res: any = { headers: {} as Record<string, string>, statusCode: 200 };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.send = () => res;
  const next = jest.fn();
  middleware({ path, ip, headers: { authorization } } as any, res, next);
  return { res, next };
}

describe('parseBasicAuth', () => {
  it('splits on the first colon only', () => expect(parseBasicAuth(basic('u', 'p:w'))).toEqual({ user: 'u', password: 'p:w' }));
  it('rejects other schemes and malformed values', () => {
    expect(parseBasicAuth('Bearer abc')).toBeNull();
    expect(parseBasicAuth(undefined)).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from('nocolon').toString('base64')}`)).toBeNull();
  });
});

describe('credentialsMatch', () => {
  it('requires both user and password', () => {
    expect(credentialsMatch(expected, expected)).toBe(true);
    expect(credentialsMatch({ ...expected, user: 'x' }, expected)).toBe(false);
    expect(credentialsMatch({ ...expected, password: 'x' }, expected)).toBe(false);
  });
});

describe('docs auth middleware', () => {
  it('does not touch other routes', () => {
    const { next } = run(createDocsAuth(expected), '/api/health');
    expect(next).toHaveBeenCalled();
  });

  it.each(['/api/docs', '/api/docs/', '/api/docs-json', '/api/docs-yaml', '/api/docs/swagger-ui-bundle.js'])('challenges %s without credentials', (path) => {
    const { res, next } = run(createDocsAuth(expected), path);
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Basic');
    expect(next).not.toHaveBeenCalled();
  });

  it('lets correct credentials through', () => {
    const { next, res } = run(createDocsAuth(expected), '/api/docs-json', basic(expected.user, expected.password));
    expect(next).toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('rejects wrong credentials, then rate limits the IP', () => {
    let t = 1_000;
    const mw = createDocsAuth(expected, () => t);
    for (let i = 0; i < 10; i++) expect(run(mw, '/api/docs', basic('x', 'y')).res.statusCode).toBe(401);
    expect(run(mw, '/api/docs', basic(expected.user, expected.password)).res.statusCode).toBe(429); // even the right password is blocked
    expect(run(mw, '/api/docs', basic('x', 'y'), '2.2.2.2').res.statusCode).toBe(401); // other IPs are unaffected
    t += 11 * 60_000;
    expect(run(mw, '/api/docs', basic(expected.user, expected.password)).next).toHaveBeenCalled(); // window expired
  });

  it('does not count a request without credentials as a failure', () => {
    const mw = createDocsAuth(expected);
    for (let i = 0; i < 20; i++) run(mw, '/api/docs');
    expect(run(mw, '/api/docs', basic(expected.user, expected.password)).next).toHaveBeenCalled();
  });
});

describe('docsCredentials', () => {
  it('needs both variables', () => {
    expect(docsCredentials({ SWAGGER_USER: 'a', SWAGGER_PASSWORD: 'b' } as any)).toEqual({ user: 'a', password: 'b' });
    expect(docsCredentials({ SWAGGER_USER: 'a' } as any)).toBeNull();
    expect(docsCredentials({} as any)).toBeNull();
  });
});
