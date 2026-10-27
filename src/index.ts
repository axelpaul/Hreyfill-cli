#!/usr/bin/env bun
import { main } from './cli';
import { SafeError } from './client';
main(Bun.argv.slice(2)).catch((error: unknown) => {
  console.error(JSON.stringify({error: error instanceof SafeError ? error.message : 'Operation failed; private details suppressed'}));
  process.exitCode = 1;
});
