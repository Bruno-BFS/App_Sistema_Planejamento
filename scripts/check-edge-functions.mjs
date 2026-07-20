import { build } from 'esbuild'

const edgeFunctions = [
  'supabase/functions/google-calendar-sync/index.ts',
]

for (const entryPoint of edgeFunctions) {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    external: ['https://*'],
    logLevel: 'warning',
    platform: 'neutral',
    write: false,
  })
}

console.log(`${edgeFunctions.length} Edge Function validada com sucesso.`)
