import { z } from 'zod';
import { ISession } from './login';
import { request } from './request';

const zCreatePatResponse = z.object({
  patToken: z.object({
    displayName: z.string(),
    authorizationId: z.string(),
    token: z.string(),
  }),
});

export interface ICreatedPat {
  id: string;
  name: string;
  value: string;
}

/**
 * Create a new ADO personal access token for an organization.
 */
export async function createPat(session: ISession, org: string): Promise<ICreatedPat> {
  const validTo = new Date();

  validTo.setDate(validTo.getDate() + 90);

  const res = await request(`https://vssps.dev.azure.com/${org}/_apis/tokens/pats`, {
    method: 'POST',
    query: { 'api-version': '6.1-preview.1' },
    auth: `Bearer ${await session.getAccessToken()}`,
    body: {
      displayName: `ado-npm-${org}-${new Date().toISOString()}`,
      scope: 'vso.packaging_write',
      validTo: validTo.toISOString(),
      allOrgs: false,
    },
    parser: async (res) => zCreatePatResponse.parse(await res.json()),
  });

  const { authorizationId: id, displayName: name, token: value } = res.patToken;

  return { id, name, value };
}
