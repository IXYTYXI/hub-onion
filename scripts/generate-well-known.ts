import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type PackageJson = {
  version?: string
}

type DiscoveryDocument = {
  apiBase: string
  authBase: string
  minCliVersion: string
  registry: string
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const publicWellKnownDir = path.join(repoRoot, 'public', '.well-known')

async function readPackageVersion(packageJsonPath: string) {
  const raw = await readFile(packageJsonPath, 'utf8')
  const pkg = JSON.parse(raw) as PackageJson
  if (!pkg.version) {
    throw new Error(`Missing version in ${packageJsonPath}`)
  }
  return pkg.version
}

async function writeDiscoveryFile(filename: string, document: DiscoveryDocument) {
  const filePath = path.join(publicWellKnownDir, filename)
  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return filePath
}

async function main() {
  const clawhubVersion = await readPackageVersion(
    path.join(repoRoot, 'packages', 'clawhub', 'package.json')
  )

  const document: DiscoveryDocument = {
    apiBase: 'https://clawhub.ai',
    authBase: 'https://clawhub.ai',
    minCliVersion: clawhubVersion,
    registry: 'https://clawhub.ai',
  }

  await mkdir(publicWellKnownDir, { recursive: true })

  const writtenFiles = await Promise.all([
    writeDiscoveryFile('clawhub.json', document),
  ])

  console.log(`Generated ${writtenFiles.join(', ')}`)
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
