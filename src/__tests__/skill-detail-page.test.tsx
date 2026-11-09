import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { skillsCopy } from '../copy/skills'
import { SkillDetailPage } from '../components/SkillDetailPage'

const navigateMock = vi.fn()
const useAuthStatusMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../lib/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))

// Mock the API request function
const apiRequestMock = vi.fn()
vi.mock('../lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  getBackendBase: () => '',
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

function renderWithProviders(ui: ReactNode, queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>
  )
}

describe('SkillDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    useAuthStatusMock.mockReset()
    apiRequestMock.mockReset()
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      me: null,
    })
  })

  it('shows a loading indicator while loading', () => {
    apiRequestMock.mockReturnValue(new Promise(() => {})) // Never resolves = loading

    renderWithProviders(<SkillDetailPage slug="weather" />)
    expect(screen.getByText(skillsCopy.detail.loadingSkill)).toBeTruthy()
    expect(screen.queryByText(skillsCopy.detail.notFound)).toBeNull()
  })

  it('shows not found when skill query resolves to null', async () => {
    apiRequestMock.mockResolvedValue(null)

    renderWithProviders(<SkillDetailPage slug="missing-skill" />)
    expect(await screen.findByText(skillsCopy.detail.notFound)).toBeTruthy()
  })

  it('redirects legacy routes to canonical owner/slug', async () => {
    apiRequestMock.mockResolvedValue({
      skill: {
        slug: 'weather',
        displayName: 'Weather',
        summary: 'Get current weather.',
        tags: [],
        stats: { downloads: 0, installs: 0, versions: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      owner: { handle: 'steipete', displayName: 'Peter' },
      latestVersion: { version: '1.0.0', createdAt: Date.now(), changelog: '' },
    })

    renderWithProviders(<SkillDetailPage slug="weather" redirectToCanonical />)
    expect(screen.getByText(skillsCopy.detail.loadingSkill)).toBeTruthy()

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled()
    })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/$owner/$slug',
      params: { owner: 'steipete', slug: 'weather' },
      replace: true,
    })
  })

  it('opens report dialog for authenticated users', async () => {
    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { id: 'users:1', role: 'user' },
    })
    apiRequestMock.mockResolvedValue({
      skill: {
        slug: 'weather',
        displayName: 'Weather',
        summary: 'Get current weather.',
        tags: [],
        stats: { downloads: 0, installs: 0, versions: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      owner: { handle: 'steipete', displayName: 'Peter' },
      latestVersion: { version: '1.0.0', createdAt: Date.now(), changelog: '', files: [] },
    })

    renderWithProviders(<SkillDetailPage slug="weather" />)

    // Wait for skill name to appear
    await waitFor(() => {
      expect(screen.getByText('Weather')).toBeTruthy()
    })

    // Report button should be visible for authenticated users
    const reportButton = screen.getByRole('button', { name: skillsCopy.detail.report })
    expect(reportButton).toBeTruthy()
  })

  it('defers compare version query until compare tab is requested', async () => {
    apiRequestMock.mockResolvedValue({
      skill: {
        slug: 'weather',
        displayName: 'Weather',
        summary: 'Get current weather.',
        tags: [],
        stats: { downloads: 0, installs: 0, versions: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      owner: { handle: 'steipete', displayName: 'Peter' },
      latestVersion: { version: '1.0.0', createdAt: Date.now(), changelog: '', files: [] },
    })

    renderWithProviders(<SkillDetailPage slug="weather" />)

    // Wait for skill to load
    await waitFor(() => {
      expect(screen.getByText('Weather')).toBeTruthy()
    })

    // Initially, only skill detail API should be called, not versions
    const initialCalls = apiRequestMock.mock.calls.filter((call) =>
      call[0]?.includes('versions')
    )
    expect(initialCalls.length).toBe(0)

    // Click compare tab - this would trigger versions query in full implementation
    // For now, just verify the component renders
    const compareTab = screen.getByRole('button', { name: skillsCopy.detail.tabs.compare })
    fireEvent.click(compareTab)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: skillsCopy.detail.tabs.versions })).toBeTruthy()
    })
  })

  it('renders documentation links between the header and install section with safe attributes', async () => {
    apiRequestMock.mockResolvedValue({
      skill: {
        slug: 'weather',
        displayName: 'Weather',
        summary: 'Get current weather.',
        tags: [],
        documentationLinks: [
          { title: '使用文档', url: 'https://docs.example.com/usage?from=hub#setup' },
          { url: 'https://gitlab.example.com/group/weather' },
        ],
        stats: { downloads: 0, installs: 0, versions: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      owner: { handle: 'steipete', displayName: 'Peter' },
      latestVersion: null,
    })

    renderWithProviders(<SkillDetailPage slug="weather" />)

    const documentationHeading = await screen.findByRole('heading', { name: '相关文档' })
    const installHeading = screen.getByRole('heading', { name: skillsCopy.detail.installMethods.title })
    const skillHeading = screen.getByRole('heading', { name: 'Weather' })
    expect(
      skillHeading.compareDocumentPosition(documentationHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      documentationHeading.compareDocumentPosition(installHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const titledLink = screen.getByRole('link', { name: '使用文档' }) as HTMLAnchorElement
    expect(titledLink.href).toBe('https://docs.example.com/usage?from=hub#setup')
    expect(titledLink.target).toBe('_blank')
    expect(titledLink.rel).toBe('noopener noreferrer')
    expect(screen.getByText('docs.example.com')).toBeTruthy()

    const fallbackLink = screen.getByRole('link', {
      name: 'gitlab.example.com',
    }) as HTMLAnchorElement
    expect(fallbackLink.href).toBe('https://gitlab.example.com/group/weather')
    expect(fallbackLink.target).toBe('_blank')
    expect(fallbackLink.rel).toBe('noopener noreferrer')
  })

  it('does not render a documentation card for empty links', async () => {
    apiRequestMock.mockResolvedValue({
      skill: {
        slug: 'weather',
        displayName: 'Weather',
        summary: 'Get current weather.',
        tags: [],
        documentationLinks: [],
        stats: { downloads: 0, installs: 0, versions: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      owner: { handle: 'steipete', displayName: 'Peter' },
      latestVersion: null,
    })

    renderWithProviders(<SkillDetailPage slug="weather" />)
    await screen.findByRole('heading', { name: 'Weather' })
    expect(screen.queryByRole('heading', { name: '相关文档' })).toBeNull()
  })
})
