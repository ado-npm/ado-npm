export interface IRegistry {
  org: string;
  project: string | null;
  feed: string;
  url: string;
}

/**
 * Extract the parts of an ADO registry URL.
 */
export function parseRegistry(registry: string): IRegistry | null {
  const matchers = [
    /^(https:\/\/pkgs\.dev\.azure\.com\/([^\/]+)(?:\/([^_\/][^\/]*))?\/_packaging\/([^\/@]+)[^\/]*\/npm\/registry)(?:\/|$)/,
    /^(https:\/\/([^\/.]+).pkgs\.visualstudio\.com(?:\/([^_\/][^\/]*))?\/_packaging\/([^\/@]+)[^\/]*\/npm\/registry)(?:\/|$)/,
    /^()([^\/]+)(?:\/([^\/]+))?\/([^\/]+)$/,
  ];

  for (const matcher of matchers) {
    const match = registry.match(matcher);

    if (match) {
      const [, fullUrl, org, project, feed] = match;
      const url =
        fullUrl || `https://pkgs.dev.azure.com/${org}${project ? `/${project}` : ''}/_packaging/${feed}/npm/registry/`;

      return {
        org,
        project,
        feed,
        url,
      };
    }
  }

  return null;
}

/**
 * Generate all valid ADO registry URLs for an org, project, and feed.
 */
export function getRegistryUrls({ org, project, feed }: IRegistry): string[] {
  return [
    `https://pkgs.dev.azure.com/${org}${project ? `/${project}` : ''}/_packaging/${feed}/npm/registry/`,
    `https://${org}.pkgs.visualstudio.com${project ? `/${project}` : ''}/_packaging/${feed}/npm/registry/`,
  ];
}
