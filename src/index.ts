#!/usr/bin/env node
import 'source-map-support/register';
import chalk from 'chalk';
import { version } from '../package.json';
import { command } from './command';
import { auth } from './commands/auth';
import { add } from './commands/add';
import { set } from './commands/set';
import { upstreamSync } from './commands/upstream-sync';

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [cmd, args] = argv[0]?.[0] != '-' ? [argv[0], argv.slice(1)] : [undefined, argv];

  switch (cmd) {
    case 'auth':
    case 'login':
    case 'l':
      await auth(args);
      return;
    case 'add':
    case 'install':
    case 'i':
      await add(args);
      return;
    case 'upstream-sync':
      await upstreamSync(args);
      return;
    case 'set':
    case 'config':
      await set(args);
      return;
  }

  await command({
    usage: `
Usage: ado-npm <command> [...options]
       ado-npm <command> -h|--help
       ado-npm -h|--help
       ado-npm -v|--version

Options:
  -h|--help      Print this help text
  -v|--version   Print version number

Commands:
  auth|login|l    Authorize ADO NPM registries
  add|install|i   Install global packages
  upstream-sync   Add a recent upstream package to an ADO NPM registry.
  set|config      Set default options
    `,
    spec: {
      help: Boolean,
      h: 'help',
      version: Boolean,
      v: 'version',
    },
    version,
    permissive: true,
    args,
    action: async () => {
      if (cmd == null) {
        throw Error('Missing command');
      } else {
        throw Error(`Unknown command: ${cmd}`);
      }
    },
  });
}

if (require.main === module) {
  main().catch((error) => {
    if (typeof error.exitCode === 'number') {
      process.exitCode = error.exitCode || 1;
      return;
    }

    process.exitCode = 1;
    console.error(chalk.red(`${error.message || error}`));
  });
}
