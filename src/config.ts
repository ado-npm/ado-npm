import os from 'os';
import path from 'path';
import { z } from 'zod';
import { getIni, IIni } from './ini';
import { Expand } from './types';

const zConfigData = z.object({
  registry: z.string().optional(),
  tenant: z.string().optional(),
});

export type ConfigData = Expand<z.infer<typeof zConfigData>>;
export type Config = IIni<ConfigData>;

/**
 * Get the ado-npm configuration.
 */
export async function getConfig(): Promise<Config> {
  return getIni(path.resolve(os.homedir(), '.ado-npm'), (data) => zConfigData.parse(data));
}
