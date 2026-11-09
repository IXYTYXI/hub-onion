/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeCopy } from '../copy/home'
import { Route } from '../routes/index'

const apiRequestMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
  createFileRoute: () => (config: { component: unknown }) => ({
    options: config,
    useNavigate: () => vi.fn(),
  }),
}))

vi.mock('../lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}))

vi.mock('../lib/site', () => ({
  getSiteMode: () => 'skills',
}))

vi.mock('../components/InstallSwitcher', () => ({
  InstallSwitcher: () => <div>install-switcher</div>,
}))

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('home route', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('renders highlighted and popular skills from live queries', async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        items: [
          {
            slug: 'daily-paper',
            displayName: 'Daily Paper',
            summary: '精选论文摘要',
            tags: ['latest'],
            stats: { downloads: 5, installs: 2, versions: 1, stars: 0 },
            highlighted: true,
            createdAt: 1,
            updatedAt: 2,
            latestVersion: { version: '1.0.0', createdAt: 2, changelog: 'init' },
          },
        ],
        nextCursor: null,
      })
      .mockResolvedValueOnce({
        items: [
          {
            slug: 'popular-skill',
            displayName: 'Popular Skill',
            summary: '热门技能',
            tags: ['prod'],
            stats: { downloads: 50, installs: 10, versions: 3, stars: 0 },
            highlighted: false,
            createdAt: 1,
            updatedAt: 3,
            latestVersion: { version: '2.0.0', createdAt: 3, changelog: 'update' },
          },
        ],
        nextCursor: null,
      })

    renderWithProviders(<Route.options.component />)

    await waitFor(() => {
      expect(screen.getByText('Daily Paper')).toBeTruthy()
      expect(screen.getByText('Popular Skill')).toBeTruthy()
    })

    expect(screen.getByRole('note', { name: '首页公告' })).toBeTruthy()
    expect(screen.getByText('公告')).toBeTruthy()
    const feedbackLink = screen.getByRole('link', { name: 'OnionHub需求/建议/Bug收集' })
    expect(feedbackLink.getAttribute('href')).toBe(
      'https://guanghe.feishu.cn/share/base/form/shrcnBdWsvNDKIGgnUyzgBN6FJf',
    )
    expect(screen.getByText(/如有需求、建议、Bug辛苦大家帮忙反馈，感谢/)).toBeTruthy()

    expect(apiRequestMock).toHaveBeenCalledWith('/skills?highlighted=1&sort=updated&dir=desc&limit=6')
    expect(apiRequestMock).toHaveBeenCalledWith('/skills?sort=downloads&dir=desc&limit=6')
  })

  it('renders html announcements when configured', () => {
    const mutableSkillsCopy = homeCopy.skills as {
      heroAnnouncement: { format: 'markdown' | 'html'; content: string }
    }
    const originalAnnouncement = mutableSkillsCopy.heroAnnouncement

    mutableSkillsCopy.heroAnnouncement = {
      format: 'html',
      content: '<a href="https://example.com/feedback">HTML公告</a>，欢迎继续反馈',
    }
    apiRequestMock.mockResolvedValue({ items: [], nextCursor: null })

    try {
      renderWithProviders(<Route.options.component />)

      const announcementLink = screen.getByRole('link', { name: 'HTML公告' })
      expect(announcementLink.getAttribute('href')).toBe('https://example.com/feedback')
      expect(screen.getByText(/欢迎继续反馈/)).toBeTruthy()
    } finally {
      mutableSkillsCopy.heroAnnouncement = originalAnnouncement
    }
  })
})
