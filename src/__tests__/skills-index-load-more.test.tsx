/* @vitest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiRequestMock } from './helpers/apiMock'

import { SkillsIndex } from '../routes/skills/index'

const navigateMock = vi.fn()
let searchMock: Record<string, unknown> = {}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (_config: { component: unknown; validateSearch: unknown }) => ({
    useNavigate: () => navigateMock,
    useSearch: () => searchMock,
  }),
  redirect: (options: unknown) => ({ redirect: options }),
  Link: (props: { children: ReactNode }) => <a href="/">{props.children}</a>,
}))

vi.mock('../lib/apiClient', () => ({
  apiRequest: apiRequestMock,
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        logger: {
          log: console.log,
          warn: console.warn,
          error: () => {},
        },
      },
    },
  })
}

function renderWithProviders(ui: ReactNode) {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>
  )
}

describe('SkillsIndex load-more observer', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    searchMock = {}
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({
      items: [],
      nextCursor: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('triggers one request for repeated intersection callbacks', async () => {
    apiRequestMock.mockResolvedValue({
      items: [makeListResult('skill-0', 'Skill 0')],
      nextCursor: null,
    })

    renderWithProviders(<SkillsIndex />)

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(1)
    })

    const observerCalls: Array<() => void> = []
    stubIntersectionObserver(observerCalls, 'next')

    renderWithProviders(<SkillsIndex />)

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled()
    })

    // Call observer multiple times
    observerCalls.forEach((call) => call())
    observerCalls.forEach((call) => call())

    // Should still only be one additional call
    expect(apiRequestMock).toHaveBeenCalledTimes(2)
  })

  it('loads more items when sentinel intersects', async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        items: [makeListResult('skill-0', 'Skill 0')],
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        items: [makeListResult('skill-1', 'Skill 1')],
        nextCursor: null,
      })

    const observerCalls: Array<() => void> = []
    stubIntersectionObserver(observerCalls, 'cursor-1')

    renderWithProviders(<SkillsIndex />)

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(observerCalls.length).toBeGreaterThan(0)
    })

    // Trigger load more
    act(() => {
      observerCalls[0]?.()
    })

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledTimes(2)
    })
  })
})

function makeListResult(slug: string, displayName: string) {
  return {
    slug,
    displayName,
    summary: 'A test skill',
    tags: [] as string[],
    stats: { downloads: 0, installs: 0, versions: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function stubIntersectionObserver(observerCalls: Array<() => void>, cursor: string) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      readonly root = null
      readonly rootMargin = ''
      readonly thresholds = []

      constructor(private readonly callback: IntersectionObserverCallback) {
        observerCalls.push(() => {
          this.callback(
            [{ isIntersecting: true, target: { dataset: { cursor } } }] as unknown as IntersectionObserverEntry[],
            this,
          )
        })
      }

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
}
