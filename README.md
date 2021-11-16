# Azure DevOps NPM Utilities

Command line utility for interacting with Azure DevOps private NPM registries.

- Configure long-lived credentials for private Azure DevOps NPM registries.
- Authorize and globally install private packages with a single command.

__Note__: This tool is using the Azure Devops [PAT Lifecycle Management API](https://docs.microsoft.com/en-us/rest/api/azure/devops/tokens/pats) _preview version_. Version 1 of this tool will be released when the API reaches non-preview status.

## Prerequisites

You will need an [Azure DevOps](https://azure.microsoft.com/en-us/services/devops/) organization which is [connected to AAD](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/connect-organization-to-azure-ad), and an AAD user which is a member of both the organization and directory.

## Authorize

Authorize for all ADO NPM registries found in your the _nearest_ `.npmrc` file. This is a replacement for the legacy Windows-only [vsts-npm-auth](https://www.npmjs.com/package/vsts-npm-auth) package.

```bash
npx ado-npm auth --npmrc
```

Authorize for specific ADO NPM registries (org or project scoped). You can use the `--registry` option multiple times to authorize for multiple registries all at once.

```bash
npx ado-npm auth --registry <uri>
npx ado-npm auth --registry <uri-1> --registry <uri-2>
```

Registry URIs (for this and other commands) can be the full DevOps URL or a path-like short form which includes only the org, (optional) project, and feed, separated by slashes.

Full URL example:

```bash
--registry https://pkgs.dev.azure.com/<org>/<project>/_packaging/<feed>/npm/registry/
```

Path-like short example:

```bash
--registry <org>/<project>/<feed>
```

Personal access tokens are generated with a 90 day lifetime and permission to read and write packages.

## Install

Install _global_ packages with a single command, including authorization if necessary.

```bash
npx ado-npm add --registry <uri> <...packages>
```

Global packages are always installed using `npm`. To remove them, use the `npm uninstall -g <...packages>` command.

## Configure

You can set default values for the `--registry` and `--tenant` options. When defaults are set, these options can be omitted from any other command.

```bash
npx ado-npm set --registry <uri> --tenant <id_or_domain>
```

Explicitly choosing a tenant should only be necessary in rare cases.
