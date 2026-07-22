import { build } from 'esbuild'
import path from 'node:path'

const edgeFunctions = [
  './supabase/functions/google-calendar-sync/index.ts',
  './supabase/functions/dispatch-web-push/index.ts',
]

for (const entryPoint of edgeFunctions) {
  await build({
    entryPoints: [path.resolve(entryPoint)],
    bundle: true,
    external: ['https://*', 'npm:*', 'jsr:*'],
    logLevel: 'warning',
    platform: 'neutral',
    write: false,
  })
}

console.log(`${edgeFunctions.length} Edge Function validada com sucesso.`)
