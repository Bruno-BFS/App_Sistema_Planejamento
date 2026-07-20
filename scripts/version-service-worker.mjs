import { readFile, writeFile } from 'node:fs/promises'

const serviceWorkerPath = new URL('../dist/sw.js', import.meta.url)
const buildVersion = process.env.VERCEL_GIT_COMMIT_SHA
  ?? process.env.GITHUB_SHA
  ?? new Date().toISOString().replace(/\D/g, '').slice(0, 14)

const source = await readFile(serviceWorkerPath, 'utf8')
await writeFile(serviceWorkerPath, source.replaceAll('__BUILD_VERSION__', buildVersion), 'utf8')
