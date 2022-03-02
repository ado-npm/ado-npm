# Azure DevOps NPM Utilities

Command line utility for interacting with Azure DevOps private NPM registries.

- Configure long-lived (90 day) credentials with interactive browser authorization.
- Authorize and globally install private packages with a single command.

**Note**: This tool is using the Azure Devops [PAT Lifecycle Management API](https://docs.microsoft.com/en-us/rest/api/azure/devops/tokens/pats) _preview version_. Version 1 of this tool will be released when the API reaches non-preview status.

## Prerequisites

You will need an [Azure DevOps](https://azure.microsoft.com/en-us/services/devops/) organization which is [connected to AAD](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/connect-organization-to-azure-ad), and an AAD user which is a member of both the organization and directory.

## Authorize

Authorize all ADO NPM registries found in the _nearest_ `.npmrc`, `.yarnrc`, and lock (`package-json.lock` or `yarn.lock`) files. This is a replacement for the legacy Windows-only [vsts-npm-auth](https://www.npmjs.com/package/vsts-npm-auth) package.

```bash
npx --registry=https://registry.npmjs.org ado-npm auth --detect
```

**Note**: Adding the `--registry=https://registry.npmjs.org` argument immediately after `npx` and before `ado-npm` is recommended in case your local `.npmrc` file contains a`registry=<url>` that you don't currently have credentials for.

Authorize specific ADO NPM registries (org or project scoped). You can use the `--registry` option multiple times to authorize for multiple registries all at once.

```bash
npx --registry=https://registry.npmjs.org ado-npm auth --registry=<uri>
npx --registry=https://registry.npmjs.org ado-npm auth --registry=<uri-1> --registry=<uri-2>
```

**Note**: The `--registry` argument _before_ the `ado-npm` command is an `npx` argument, which determines where NPX will install the `ado-npm` package from. The `--registry` arguments which _follow_ `ado-npm` are the registries that require authorization.

Registry URIs (for this and other commands) can be the full Azure DevOps URL or a path-like short form which includes only the org, (optional) project, and feed, separated by slashes.

Full URL example:

```bash
--registry=https://pkgs.dev.azure.com/<org>/<project>/_packaging/<feed>/npm/registry/
```

Path-like short example:

```bash
--registry=<org>/<project>/<feed>
```

Personal access tokens are generated with a 90 day lifetime, scoped to a single organization, and have permission to read and write packages. Credentials are only ever stored in the users `$HOME/.npmrc` file.

## Install

Install packages _globally_ with a single command, interactively authorizing if necessary.

```bash
npx --registry=https://registry.npmjs.org ado-npm add --registry=<uri> <...packages>
```

Global packages are always installed using `npm`. To remove them, use the `npm uninstall -g <...packages>` command.

## Configure

You can set default values for the `--registry`, `--tenant`, or `--lifetime` options. When defaults are set, these options can be omitted from any other command.

```bash
npx --registry=https://registry.npmjs.org ado-npm set --registry=<uri> --lifetime=<days> --tenant=<value>
```

Explicitly choosing a tenant should only be necessary in rare cases.
