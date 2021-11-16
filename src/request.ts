import fetch from 'node-fetch';
import { Response } from 'node-fetch';
import { array } from './array';
import { FetchError, FetchResponseError } from './error';

export interface IHttpOptions<T> {
  ok?: true | number | number[];
  errors?: Record<number, string | ((res: Response) => Error)>;
  method?: string;
  query?: Record<string, string | boolean | number | null | undefined>;
  auth?: string;
  body?: any;
  parser?: (response: Response) => Promise<T>;
}

/**
 * Fetch helper.
 */
export async function request<T = string>(
  url: string,
  {
    ok = 200,
    errors = {},
    query = {},
    method = 'GET',
    auth,
    body,
    parser = (res) => res.text() as unknown as Promise<T>,
  }: IHttpOptions<T> = {},
): Promise<T> {
  const queryString = new URLSearchParams(
    Object.entries(query).reduce<string[][]>(
      (acc, [key, value]) => (value == null ? acc : [...acc, [key, `${value}`]]),
      [],
    ),
  ).toString();
  const res = await fetch(`${url}${queryString ? `?${queryString}` : ''}`, {
    method,
    body: body == null ? undefined : JSON.stringify(body, null, '  '),
    headers: {
      Accept: 'application/json',
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: auth } : {}),
    },
  });

  if (ok !== true && !array(ok).includes(res.status)) {
    const error = errors[res.status];

    if (typeof error === 'function') {
      throw error(res);
    } else {
      throw FetchError(res, error);
    }
  }

  try {
    return await parser(res);
  } catch {
    throw FetchResponseError(res);
  }
}
