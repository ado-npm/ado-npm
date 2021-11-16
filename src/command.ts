import arg from 'arg';
import { Expand } from './types';
import { Config, getConfig } from './config';

type Prefix<T> = T extends string
  ? T extends `-${string}` | '_'
    ? T
    : T extends { length: 1 }
    ? `-${T}`
    : `--${T}`
  : T;
type UnPrefix<T> = T extends `--${infer L}` ? L : T extends `-${infer S}` ? S : T;

type CommandSpec<TSpec extends arg.Spec> = {
  [P in Prefix<keyof TSpec>]: TSpec[P extends keyof TSpec ? P : UnPrefix<P>];
};

type CommandOptions<TResult extends arg.Result<any>> = Expand<{
  [P in UnPrefix<keyof TResult>]: TResult[Prefix<P>];
}>;

function getCommandSpec<TSpec extends arg.Spec>(spec: TSpec): CommandSpec<TSpec> {
  const fixed: arg.Spec = {};

  for (const [key, value] of Object.entries(spec)) {
    fixed[key[0] === '-' ? key : key.length === 1 ? `-${key}` : `--${key}`] =
      typeof value === 'string' && value[0] !== '-' ? (value.length === 1 ? `-${value}` : `--${value}`) : value;
  }

  return fixed as CommandSpec<TSpec>;
}

function getCommandOptions<TResult extends arg.Result<any>>(result: TResult): CommandOptions<TResult> {
  const options: Record<string, any> = {};

  for (const [key, value] of Object.entries(result)) {
    options[key[0] === '-' ? (key[1] === '-' ? key.slice(2) : key.slice(1)) : key] = value;
  }

  return options as CommandOptions<TResult>;
}

export interface ICommandOptions<TSpec extends arg.Spec> {
  spec: TSpec;
  args?: string[];
  permissive?: boolean;
  usage?: string;
  version?: string;
  action: (options: CommandOptions<arg.Result<CommandSpec<TSpec>>>, config: Config) => Promise<void>;
}

/**
 * CLI command.
 */
export async function command<TSpec extends arg.Spec>({
  spec,
  args,
  permissive = false,
  usage,
  version,
  action,
}: ICommandOptions<TSpec>): Promise<void> {
  const prefixedSpec = getCommandSpec(spec);
  const argResult = arg(prefixedSpec, { argv: args, permissive });
  const options = getCommandOptions(argResult);
  const config = await getConfig();

  if (usage && (options as any).help === true) {
    console.log(usage.trim() + '\n');
    return;
  }

  if (version && (options as any).version === true) {
    console.log(version);
    return;
  }

  await action(options, config);
}

/**
 * Create a CLI command function.
 */
export function createCommand<TSpec extends arg.Spec>(
  options: ICommandOptions<TSpec>,
): (args?: string[]) => Promise<void> {
  return (args) => command({ ...options, ...(args ? { args } : {}) });
}
