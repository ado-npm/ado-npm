import chalk from 'chalk';
import { createCommand } from '../command';
import { getRegistryUrls, parseRegistry } from '../registry';
import { array } from '../array';
import { findNpmRegistries, getUnauthorizedRegistries, authorizeRegistries } from '../npm';

export const auth = createCommand({
  usage: `
Usage: ado-npm auth [...options]
       ado-npm auth -h|--help

Authorize for ADO NPM registries.

Registry values can be fully qualified URLs or short "path" forms. The option
can be set multiple times to authorize multiple registries at once.

Full registry examples:
  https://pkgs.dev.azure.com/<org>[/<project>]/_packaging/<feed>/npm/registry/
  https://pkgs.dev.azure.com/contoso/dev/_packaging/ux/npm/registry/
  https://pkgs.dev.azure.com/contoso/_packaging/ux/npm/registry/

Short registry examples:
  <org>[/<project>]/<feed>
  contoso/dev/ux
  contoso/ux

Options:
  -r|--registry <uri>    ADO NPM registry
  -l|--lifetime <days>   New PAT lifetime in days
  -d|--detect            Find registries in .npmrc and lock files
  -f|--force             Force creation of new PATs
  -t|--tenant <value>    Tenant name or ID
  -h|--help              Print this help text
  `,
  spec: {
    help: Boolean,
    h: 'help',
    registry: [String],
    r: 'registry',
    lifetime: Number,
    l: 'lifetime',
    detect: Boolean,
    d: 'detect',
    npmrc: 'detect',
    force: Boolean,
    f: 'force',
    tenant: String,
    t: 'tenant',
  },
  action: async (options, config) => {
    const { lifetime, detect = false, force = false, tenant } = { ...options, ...config.data };

    if (!detect && !options.registry && !config.data.registry) {
      throw Error('Missing required option: --registry|--detect');
    }

    let registries: string[] = [];

    if (detect) {
      (await findNpmRegistries()).forEach((uri) => {
        const registry = parseRegistry(uri);

        if (!registry) {
          return;
        }

        getRegistryUrls(registry).forEach((url) => {
          registries.push(url);
        });
      });
    }

    array(options.registry || (!detect && config.data.registry) || []).forEach((uri) => {
      const registry = parseRegistry(uri);

      if (!registry) {
        throw Error(`Invalid registry value: ${uri}`);
      }

      getRegistryUrls(registry).forEach((url) => {
        registries.push(url);
      });
    });

    console.log(`Registries:`);

    const unauthorized = await getUnauthorizedRegistries(registries, {
      force,
      onResult: (registry, result) =>
        console.log(`  ${chalk.dim(registry)} ${chalk[result === 'valid' ? 'green' : 'yellow'](`(token ${result})`)}`),
    });

    if (unauthorized.length === 0) {
      return;
    }

    await authorizeRegistries(unauthorized, tenant, lifetime);
  },
});
