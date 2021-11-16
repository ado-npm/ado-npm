/**
 * HTTP fetch error.
 */
export function FetchError(res: { url: string; status: number; statusText: string }, detail?: string): Error {
  return Error(`${res.status} ${res.statusText} (${res.url})${detail ? `: ${detail}` : ''}`);
}

/**
 * Invalid HTTP fetch response body.
 */
export function FetchResponseError(res: { url: string }): Error {
  return Error(`Invalid response body (${res.url})`);
}
