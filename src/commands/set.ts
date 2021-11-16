import { createCommand } from '../command';

export const set = createCommand({
  usage: `
Usage: ado-npm set [...options]
       ado-npm set -h|--help

Set and get default options. Empty string values will unset previously set
default options.

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
  -r|--registry <value>   ADO NPM registry
  -t|--tenant <value>     Tenant name or ID
  -h|--help               Print this help text
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
  action: async (options, config) => {
    for (const key of ['registry', 'tenant'] as const) {
      if (options[key] === '') {
        config.data[key] = undefined;
      } else if (options[key]) {
        config.data[key] = options[key];
      }
    }

    await config.save();
    console.log(JSON.stringify(config.data, null, '  '));
  },
});
