/* @vitest-environment node */

import { describe, expect, it, vi } from 'vitest'
import {
  buildCandidatePreview,
  detectImportProvider,
  detectGitHubRepositoryImport,
  type ImportRepositorySnapshot,
} from './import-providers'

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('import providers', () => {
  it('detects GitHub and configured GitLab URLs', () => {
    expect(detectImportProvider('https://github.com/acme/demo')).toBe('github')
    expect(detectImportProvider('https://gitlab.yc345.tv/acme/demo')).toBe('gitlab')
    expect(detectImportProvider('https://example.com/acme/demo')).toBeNull()
  })

  it('loads a GitHub repository import snapshot', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === 'https://api.github.com/repos/acme/demo') {
        return jsonResponse({ default_branch: 'main' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/commits/main') {
        return jsonResponse({ sha: 'githubcommitsha123' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/contents/?ref=githubcommitsha123') {
        return jsonResponse([
          {
            type: 'file',
            path: 'SKILL.md',
            size: 20,
            download_url: 'https://raw.githubusercontent.com/acme/demo/SKILL.md',
          },
        ])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const snapshot = await detectGitHubRepositoryImport('https://github.com/acme/demo', fetchMock as typeof fetch)
    expect(snapshot.provider).toBe('github')
    expect(snapshot.resolved.commit).toBe('githubcommitsha123')
    expect(snapshot.candidates).toEqual([
      {
        path: '',
        readmePath: 'SKILL.md',
        name: 'demo',
        description: null,
      },
    ])
  })

  it('builds preview paths relative to the selected candidate root', () => {
    const snapshot: ImportRepositorySnapshot = {
      provider: 'gitlab',
      resolved: {
        kind: 'gitlab',
        host: 'gitlab.com',
        repo: 'acme/demo',
        ref: 'main',
        commit: 'gitlabcommitsha456',
        path: '',
        repoUrl: 'https://gitlab.com/acme/demo',
      },
      candidates: [
        { path: 'skill', readmePath: 'skill/SKILL.md', name: 'skill', description: null },
      ],
      files: [
        { path: 'skill/SKILL.md', size: 10, downloadUrl: 'https://gitlab.com/raw/skill-md' },
        { path: 'skill/notes.md', size: 10, downloadUrl: 'https://gitlab.com/raw/notes' },
      ],
    }

    const preview = buildCandidatePreview(snapshot, 'skill')
    expect(preview.defaults.slug).toBe('skill')
    expect(preview.files.map((file) => file.path)).toEqual(['SKILL.md', 'notes.md'])
  })
})
