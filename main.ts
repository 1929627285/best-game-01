// Glowgarden's entrypoint (Node 22, standard library only). The game is the
// static files under game/; this program hands them in: it copies game/ and
// screenshots/ beside this file into the output directory and writes
// dossier.json, the summary the judge reads, with make.fun's vendored
// library. It writes the same bytes on every run: no time, no randomness,
// no network.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with: node serve.ts  (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn(directory, name) {
  const source = join(repoRoot, directory);
  const target = join(outDir, directory);
  mkdirSync(target, { recursive: true });
  if (existsSync(source)) cpSync(source, target, { recursive: true });
  return name;
}

mkdirSync(outDir, { recursive: true });
handIn('game', 'game');
handIn('screenshots', 'screenshots');

// The gate's own caps, as the scorer applies them: the dossier text cap shapes
// the bytes, and the rest refuse an entry the scorer would refuse.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
