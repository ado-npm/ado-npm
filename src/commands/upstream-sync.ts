import assert from 'assert';
import chalk from 'chalk';
import { createCommand } from '../command';
import { login } from '../login';
import { parseRegistry } from '../registry';
import { request } from '../request';

export const upstreamSync = createCommand({
  usage: `
Usage: ado-npm upstream-sync [...options] <package>@<version>
       ado-npm upstream-sync -h|--help

Add a recent upstream package to an ADO NPM registry.

Non-ADO upstream sources (eg. https://registry.npmjs.org/) are automatically
synced within 3-6 hours. Inside this window of time, new package versions may
not be available to install using the ADO NPM registry. This command will
immediately sync a single package version so that it can be installed without
waiting for the normal sync process.

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
  -t|--tenant <value>    Tenant name or ID
  -h|--help              Print this help text
  `,
  spec: {
    help: Boolean,
    h: 'help',
    registry: String,
    r: 'registry',
    tenant: String,
    t: 'tenant',
    npmrc: Boolean,
  },
  permissive: true,
  action: async (options, config) => {
    const { registry, tenant } = { ...options, ...config.data };

    assert(registry, Error('Missing required option: --registry'));

    const registryData = parseRegistry(registry);

    assert(registryData, Error(`Invalid registry: ${registry}`));
    assert(options._.length > 0, Error('Missing required argument: <package>@<version>'));
    assert(options._.length < 2, Error(`Unexpected argument: ${options._[1]}`));

    const packageSpec = options._[0].match(/^((?:@[\w-]+\/)?[\w-]+)@(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/);

    if (!packageSpec) {
      throw Error(`Invalid package spec: ${options._[0]}`);
    }

    const [, packageName, packageVersion] = packageSpec;
    const session = await login(tenant);

    await request(
      `https://pkgs.dev.azure.com/${registryData.org}/_apis/packaging/feeds/${registryData.feed}/npm/packages/${packageName}/versions/${packageVersion}/content`,
      {
        method: 'HEAD',
        auth: `Bearer ${await session.getAccessToken()}`,
        query: { 'api-version': '6.1-preview.1' },
      },
    );

    console.log(`Synchronized ${packageName}@${packageVersion}`);
  },
});
