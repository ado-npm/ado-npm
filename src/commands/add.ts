import assert from 'assert';
import execa from 'execa';
import { createCommand } from '../command';
import { login } from '../login';
import { getUnauthorizedRegistries, authorizeRegistries } from '../npm';
import { parseRegistry } from '../registry';

export const add = createCommand({
  usage: `
Usage: ado-npm add [...options] <...packages>
       ado-npm add -h|--help

Install global packages.

Registry values can be fully qualified URLs or short "path" forms.

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
  -t|--tenant <value>    Tenant name or ID
  -h|--help              Print this help text
  `,
  spec: {
    help: Boolean,
    h: 'help',
    registry: String,
    r: 'registry',
    lifetime: Number,
    l: 'lifetime',
    tenant: String,
    t: 'tenant',
    npmrc: Boolean,
  },
  permissive: true,
  action: async (options, config) => {
    const { registry, lifetime, tenant } = { ...options, ...config.data };

    assert(registry, Error('Missing required option: --registry'));

    const registryUrl = parseRegistry(registry)?.url;

    assert(registryUrl, Error(`Invalid registry: ${registry}`));

    const unauthorized = await getUnauthorizedRegistries([registryUrl]);

    if (unauthorized.length) {
      const session = await login(tenant);

      await authorizeRegistries(session, unauthorized, lifetime);
    }

    await execa('npm', ['add', '-g', '--registry', registryUrl, ...options._], { stdio: 'inherit' });
  },
});
