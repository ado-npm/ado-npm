import os from 'os';
import path from 'path';
import { findUp } from 'find-up';
import chalk from 'chalk';
import { getIni, IIni } from './ini';
import { parseRegistry } from './registry';
import { unique } from './array';
import { login } from './login';
import { createPat } from './pat';
import { request } from './request';

/**
 * Find the nearest `.npmrc` file and return the ADO registry URLs in it.
 */
export async function findNpmRegistries(): Promise<string[]> {
  const filename = await findUp('.npmrc', { type: 'file' });
  const registries: string[] = [];

  if (filename) {
    const npmrc = await getIni(filename);

    Object.entries(npmrc.data).map(([key, value]) => {
      if (/(^|:)registry$/.test(key)) {
        registries.push(value);
      }
    });
  }

  return unique(registries);
}

/**
 * Get the user's home directory `.npmrc` file (contains credentials).
 */
async function getUserNpmrc(): Promise<IIni> {
  return getIni(path.resolve(os.homedir(), '.npmrc'));
}

/**
 * Get a map of all ADO registry tokens (registry URL keys).
 */
export async function getRegistryCredentials(): Promise<Record<string, string>> {
  const matchers = [
    /^(\/\/pkgs\.dev\.azure\.com\/[^\/]+(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\/):_password$/,
    /^(\/\/[^\/.]+.pkgs\.visualstudio\.com(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\/):_password$/,
  ];

  try {
    const npmrc = await getUserNpmrc();
    const pats: Record<string, string> = {};

    for (const [key, value] of Object.entries(npmrc.data)) {
      for (const matcher of matchers) {
        const match = key.match(matcher);

        if (match) {
          try {
            pats['https:' + match[1]] = Buffer.from(value, 'base64').toString('utf8');
          } catch {
            // skip
          }

          break;
        }
      }
    }

    return pats;
  } catch {
    return {};
  }
}

export interface IUnauthorizedRegistriesOptions {
  force?: boolean;
  onResult?: (registry: string, result: 'valid' | 'invalid' | 'missing') => void;
}

/**
 * Get a filtered array of ADO registry URLs for which valid credentials do
 * not exist.
 */
export async function getUnauthorizedRegistries(
  registries: string[],
  { force = false, onResult }: IUnauthorizedRegistriesOptions = {},
): Promise<string[]> {
  if (registries.length === 0) {
    return [];
  }

  registries = unique(registries);

  const unauthorizedUrls: string[] = [];
  const creds = force ? {} : await getRegistryCredentials();

  for (const registry of unique(registries)) {
    const password = creds[registry];

    if (!password) {
      onResult?.(registry, 'missing');
      unauthorizedUrls.push(registry);
      continue;
    }

    const status = await request(registry, {
      method: 'GET',
      ok: [200, 401, 404],
      auth: `Basic ${Buffer.from(':' + password, 'utf8').toString('base64')}`,
      parser: async (res) => res.status,
    });

    if (status === 404) {
      throw Error(`Registry does not exist: ${registry}`);
    }

    if (status !== 200) {
      onResult?.(registry, 'invalid');
      unauthorizedUrls.push(registry);
      continue;
    }

    onResult?.(registry, 'valid');
  }

  return unauthorizedUrls;
}

/**
 * Log the user in and create new personal access tokens which are stored in
 * the user's home directory `.npmrc` file.
 */
export async function authorizeRegistries(
  registries: string[],
  tenant: string | undefined,
  lifetime: number | undefined,
): Promise<void> {
  if (registries.length === 0) {
    return;
  }

  registries = unique(registries);

  const pats: Record<string, string> = {};
  const orgMap: Record<string, string> = {};

  for (const registry of registries) {
    const org = parseRegistry(registry)?.org;

    if (org) {
      orgMap[registry] = org;
    }
  }

  const orgs = unique([...Object.values(orgMap)]).sort();
  const session = await login(tenant);

  console.log(`Tokens (${session.username}):`);

  for (const org of orgs) {
    const newPat = await createPat(session, org, lifetime);

    console.log(`  ${chalk.dim(newPat.name + '@' + org)} ${chalk.green('(created)')}`);
    pats[org] = newPat.value;
  }

  const npmrc = await getUserNpmrc();

  console.log(`Credentials (${npmrc.filename}):`);

  for (const registry of registries) {
    const org = orgMap[registry];
    const prefix = registry.replace(/^https:/, '');
    const password = Buffer.from(pats[org], 'utf8').toString('base64');
    const isNew = !(prefix + ':_password' in npmrc.data);

    npmrc.data[prefix + ':username'] = 'ado-npm-pat';
    npmrc.data[prefix + ':email'] = 'npm requires this but does not use it';
    npmrc.data[prefix + ':_password'] = password;

    console.log(`  ${chalk.dim(prefix + ':*')} ${chalk.green(isNew ? '(added)' : '(updated)')}`);
  }

  npmrc.save();
}
