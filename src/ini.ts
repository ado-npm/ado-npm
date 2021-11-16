import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import ini from 'ini';
import mergeOptions from 'merge-options';

async function readIni(filenameOrHandle: string | fs.FileHandle): Promise<null | Record<string, any>> {
  const text = await fs.readFile(filenameOrHandle, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  return text != null ? ini.decode(text) : null;
}

export interface IIni<T = Record<string, any>> {
  readonly data: T;
  readonly filename: string;
  load(): Promise<void>;
  save(): Promise<void>;
}

/**
 * Get an INI file instance.
 */
export async function getIni<T = Record<string, any>, I extends T = T>(
  filename: string,
  parse: (data: Record<string, any>) => T = (data) => data as T,
  initialValue: () => I = () => ({} as I),
): Promise<IIni<T>> {
  filename = path.resolve(filename);

  let promise = getIni._value.get(filename);

  if (!promise) {
    let data: T = initialValue();
    let json = JSON.stringify(data);

    const config: IIni<T> = {
      get data(): T {
        return data;
      },
      get filename(): string {
        return filename;
      },
      async load(): Promise<void> {
        const raw = await readIni(filename);

        if (raw != null) {
          data = parse(raw);
          json = JSON.stringify(data);
        }
      },
      async save(): Promise<void> {
        if (JSON.stringify(data) === json) {
          return;
        }

        const handle = await fs.open(filename, 'a+');

        try {
          data = mergeOptions.call({ concatArrays: true }, await readIni(handle), data);
          json = JSON.stringify(data);
          handle.truncate();
          await fs.writeFile(handle, ini.encode(JSON.parse(json)));
        } finally {
          await handle.close();
        }
      },
    };

    promise = config.load().then(() => config);
    getIni._value.set(filename, promise);
  }

  return promise;
}
getIni._value = new Map<string, Promise<IIni<any>>>();
