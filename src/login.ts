import http from 'http';
import { URL } from 'url';
import { AddressInfo } from 'net';
import crypto from 'crypto';
import open from 'open';
import delay from 'delay';
import chalk from 'chalk';
import { AccountInfo, CryptoProvider, LogLevel, PublicClientApplication, ResponseMode } from '@azure/msal-node';

export interface ISession {
  name: string;
  username: string;
  tenantId: string;
  claims: object;
  getAccessToken(scopes?: string[]): Promise<string>;
}

/**
 * Log in to ADO interactively using a browser.
 */
export async function login(tenant = 'common', scopes?: string[]): Promise<ISession> {
  const defaultScopes = scopes ?? ['499b84ac-1321-427f-aa17-267ca6975798/.default', 'offline_access'];
  const client = new PublicClientApplication({
    auth: {
      clientId: '04b07795-8ddb-461a-bbee-02f9e1bf7b46',
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: true,
        loggerCallback: (_loglevel, message) => console.log(message),
      },
    },
  });
  const cryptoProvider = new CryptoProvider();
  const state = crypto.randomUUID();
  const pkce = await cryptoProvider.generatePkceCodes();
  const server = http.createServer();
  const delayPromise = delay(60000);
  const close = () => {
    setTimeout(() => {
      server.close();
      server.unref();
      delayPromise.clear();
    }, 500);
  };

  const timeoutPromise = delayPromise.then(() => {
    throw Error('Timed out');
  });
  const accountPromise = new Promise<AccountInfo>((resolve, reject) => {
    server
      .on('request', (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, 'Method not allowed');
          res.end();
          return;
        }

        const port = (server.address() as AddressInfo).port;
        const url = new URL(req.url ?? '', `http://localhost${port}`);

        switch (url.pathname) {
          case '/': {
            if (url.searchParams.has('code')) {
              if (url.searchParams.get('state') !== state) {
                console.error('States do not match');
                res.writeHead(302, { Location: '/error' });
                res.end();
                return;
              }

              client
                .acquireTokenByCode({
                  code: url.searchParams.get('code') as string,
                  scopes: defaultScopes,
                  redirectUri: `http://localhost:${port}`,
                  codeVerifier: pkce.verifier, // PKCE Code Verifier
                  clientInfo: url.searchParams.get('client_info') as string,
                })
                .then((response) => {
                  if (response == null || !response.account) {
                    throw Error('Invalid token response');
                  }

                  res.writeHead(302, { Location: '/success' });
                  res.end();
                  resolve(response.account);
                })
                .catch((error) => {
                  console.error(`${error}`);
                  res.writeHead(302, { Location: '/error' });
                  res.end();
                });
            } else if (url.searchParams.has('error')) {
              console.error(url.searchParams.get('error'));
              res.writeHead(302, { Location: '/error' });
              res.end();
            } else {
              res.writeHead(200);
              res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>ado-npm</title>
</head>
<body>
  <p>Click <a href="/login">here</a> to sign in.</p>
</body>
</html>
              `);
            }
            break;
          }
          case '/login': {
            client
              .getAuthCodeUrl({
                scopes: defaultScopes,
                redirectUri: `http://localhost:${port}`,
                codeChallenge: pkce.challenge,
                codeChallengeMethod: 'S256',
                prompt: 'select_account',
                responseMode: ResponseMode.QUERY,
                nonce: crypto.randomUUID(),
                state,
              })
              .then((authUrl) => {
                res.writeHead(302, { Location: authUrl });
                res.end();
              })
              .catch((error) => {
                console.error(`${error}`);
                res.writeHead(302, { Location: '/error' });
                res.end();
              });
            break;
          }
          case '/success': {
            res.writeHead(200);
            res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>ado-npm</title>
</head>
<body>
  <p>Successfully signed in. You can close this window at anytime.</p>
</body>
</html>
            `);
            break;
          }
          case '/error': {
            res.writeHead(500);
            res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>ado-npm</title>
</head>
<body>
  <p>Something went wrong. Check the command line for more information.</p>
</body>
</html>
            `);
            break;
          }
          default: {
            res.writeHead(404, 'Not found');
            res.end();
          }
        }
      })
      .listen(0, 'localhost', () => {
        const port = (server.address() as AddressInfo).port;

        open(`http://localhost:${port}/login`);
        console.log(chalk.yellowBright(`\nSign in using your browser (http://localhost:${port})\n`));
      })
      .on('connection', (socket) => socket.unref())
      .on('error', reject);
  });

  const account = await Promise.race([timeoutPromise, accountPromise]).finally(() => close());

  return {
    name: account.name ?? '',
    username: account.username,
    tenantId: account.tenantId,
    claims: account.idTokenClaims ?? {},
    async getAccessToken(scopes): Promise<string> {
      return client
        .acquireTokenSilent({ account, scopes: scopes ?? defaultScopes })
        .then((result) => result!.accessToken);
    },
  };
}
