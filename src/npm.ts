import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { findUp } from 'find-up';
import chalk from 'chalk';
import { getIni, IIni } from './ini';
import { parseRegistry } from './registry';
import { unique } from './array';
import { login } from './login';
import { createPat } from './pat';
import { request } from './request';

/**
 * Find the nearest `.npmrc`, `.yarnrc`, and lock (`package-lock.json` or
 * `yarn.lock`) files and returns the ADO registry URLs they contain.
 */
export async function findNpmRegistries(): Promise<string[]> {
  const registries: string[] = [];
  const npmrcPath = await findUp('.npmrc', { type: 'file' });

  if (npmrcPath) {
    const npmrc = await getIni(npmrcPath);

    Object.entries(npmrc.data).map(([key, value]) => {
      if (/(^|:)registry$/.test(key)) {
        registries.push(value);
      }
    });
  }

  const yarnrcPath = await findUp('.yarnrc');

  if (yarnrcPath) {
    const yarnrc = await fs.readFile(yarnrcPath, 'utf8');
    const matchers = [
      /^\s*["']?(?:@[\w-]+:)?registry['"]?\s+["']?(https:\/\/pkgs\.dev\.azure\.com\/[^\/]+(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\/)['"]?\s*$/gm,
      /^\s*["']?(?:@[\w-]+:)?registry['"]?\s+["']?(https:\/\/[^\/.]+.pkgs\.visualstudio\.com(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\/)['"]?\s*$/gm,
    ];

    for (const matcher of matchers) {
      for (const [, match] of yarnrc.matchAll(matcher)) {
        registries.push(match);
      }
    }
  }

  const lockPath = await findUp(['package-lock.json', 'yarn.lock'], { type: 'file' });

  if (lockPath) {
    const lock = await fs.readFile(lockPath, 'utf8');
    const matchers = [
      /https:\/\/pkgs\.dev\.azure\.com\/[^\/]+(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\//g,
      /https:\/\/[^\/.]+.pkgs\.visualstudio\.com(?:\/(?:[^_\/][^\/]*))?\/_packaging\/(?:[^\/@]+)[^\/]*\/npm\/registry\//g,
    ];

    for (const matcher of matchers) {
      for (const [match] of lock.matchAll(matcher)) {
        registries.push(match);
      }
    }
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
    const pats: Record<string, string> = Object.create(null);

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
    return Object.create(null);
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
  const creds = force ? Object.create(null) : await getRegistryCredentials();

  for (const registry of unique(registries)) {
    const password: string | undefined = creds[registry];
    const status = await request(registry, {
      method: 'GET',
      ok: [200, 404, 401],
      auth: password && `Basic ${Buffer.from(':' + password, 'utf8').toString('base64')}`,
      parser: async (res) => res.status,
    });

    if (status !== 200 && status !== 404) {
      onResult?.(registry, password ? 'invalid' : 'missing');
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

  const pats: Record<string, string> = Object.create(null);
  const orgMap: Record<string, string> = Object.create(null);

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
