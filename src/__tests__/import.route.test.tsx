import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route } from '../routes/import'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  useNavigate: () => vi.fn(),
}))

const fetchMock = vi.fn()
const useAuthStatusMock = vi.fn()
const publishMutateMock = vi.fn()

vi.mock('../lib/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))

vi.mock('../hooks/usePublishSkill', () => ({
  usePublishSkill: () => ({
    mutate: publishMutateMock,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: {
      items: [{ slug: 'automation', name: '自动化', description: '', sortOrder: 10 }],
    },
    isLoading: false,
  }),
}))

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

describe('/import route', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    publishMutateMock.mockReset()
    publishMutateMock.mockImplementation((_input, options) => {
      options?.onSuccess?.({ ok: 'true', skillId: '1', versionId: '1' })
    })
    useAuthStatusMock.mockReset()
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { handle: 'tester' },
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('detects a GitHub import and shows commit pinned preview', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === 'https://api.github.com/repos/acme/demo') {
        return jsonResponse({ default_branch: 'main' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/commits/main') {
        return jsonResponse({ sha: 'githubcommitsha1234567890' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/contents/?ref=githubcommitsha1234567890') {
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

    render(<Route.component />)
    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo'), {
      target: { value: 'https://github.com/acme/demo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /开始检测/ }))

    expect(await screen.findByText(/固定 commit/i)).toBeTruthy()
    expect(await screen.findByText(/acme\/demo@main/i)).toBeTruthy()
    expect(screen.getByText(/githubcommit/)).toBeTruthy()
    expect(screen.getByText('SKILL.md')).toBeTruthy()
  })

  it('detects a GitLab import and publishes with gitlab source metadata', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.endsWith('/api/v1/import/gitlab/preview')) {
        return jsonResponse({
          resolved: {
            kind: 'gitlab',
            host: 'gitlab.yc345.tv',
            repo: 'group/demo',
            ref: 'main',
            commit: 'gitlabcommitsha4567890',
            path: '',
            repoUrl: 'https://gitlab.yc345.tv/group/demo',
          },
          candidates: [{ path: '', readmePath: 'SKILL.md', name: 'demo', description: null }],
        })
      }
      if (url.endsWith('/api/v1/import/gitlab/candidate')) {
        return jsonResponse({
          resolved: {
            kind: 'gitlab',
            host: 'gitlab.yc345.tv',
            repo: 'group/demo',
            ref: 'main',
            commit: 'gitlabcommitsha4567890',
            path: '',
            repoUrl: 'https://gitlab.yc345.tv/group/demo',
          },
          candidate: { path: '', readmePath: 'SKILL.md', name: 'demo', description: null },
          defaults: {
            selectedPaths: ['SKILL.md'],
            slug: 'demo',
            displayName: 'Demo',
            version: '0.1.0',
            tags: ['latest'],
          },
          files: [{ path: 'SKILL.md', size: 20, defaultSelected: true }],
        })
      }
      if (url.endsWith('/api/v1/import/gitlab/files')) {
        return new Response(
          JSON.stringify({
            files: [
              {
                path: 'SKILL.md',
                contentBase64: btoa('# Demo'),
                contentType: 'text/markdown',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<Route.component />)
    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo'), {
      target: { value: 'https://gitlab.yc345.tv/group/demo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /开始检测/ }))

    expect(await screen.findByText(/group\/demo@main/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('自动化'))

    fireEvent.click(screen.getByRole('button', { name: /导入并发布/i }))

    await waitFor(() => {
      expect(publishMutateMock).toHaveBeenCalledTimes(1)
    })

    const publishInput = publishMutateMock.mock.calls[0]?.[0]
    expect(publishInput?.payload?.categorySlugs).toEqual(['automation'])
    expect(publishInput?.payload?.source).toEqual(
      expect.objectContaining({
        kind: 'gitlab',
        repo: 'group/demo',
        ref: 'main',
        commit: 'gitlabcommitsha4567890',
        path: '.',
      }),
    )
  })

  it('shows a candidate picker when multiple skills are detected', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url === 'https://api.github.com/repos/acme/demo') {
        return jsonResponse({ default_branch: 'main' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/commits/main') {
        return jsonResponse({ sha: 'githubcommitsha1234567890' })
      }
      if (url === 'https://api.github.com/repos/acme/demo/contents/?ref=githubcommitsha1234567890') {
        return jsonResponse([
          {
            type: 'file',
            path: 'a/SKILL.md',
            size: 20,
            download_url: 'https://raw.githubusercontent.com/acme/demo/a/SKILL.md',
          },
          {
            type: 'file',
            path: 'b/SKILL.md',
            size: 20,
            download_url: 'https://raw.githubusercontent.com/acme/demo/b/SKILL.md',
          },
        ])
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<Route.component />)
    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo'), {
      target: { value: 'https://github.com/acme/demo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /开始检测/ }))

    expect(await screen.findByText(/选择技能/i)).toBeTruthy()
    expect(screen.getAllByText('a').length).toBeGreaterThan(0)
    expect(screen.getAllByText('b').length).toBeGreaterThan(0)
  })

  it('surfaces gitlab preview auth errors', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = requestUrl(input)
      if (url.endsWith('/api/v1/import/gitlab/preview')) {
        return new Response(JSON.stringify({ error: 'gitlab host is not allowed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<Route.component />)
    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo'), {
      target: { value: 'https://gitlab.yc345.tv/group/demo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /开始检测/ }))

    expect(await screen.findByText(/gitlab host is not allowed/i)).toBeTruthy()
  })
})
