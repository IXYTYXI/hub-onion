/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  detectSiteMode,
  detectSiteModeFromUrl,
  getClawHubSiteUrl,
  getOnlyCrabsHost,
  getOnlyCrabsSiteUrl,
  getSiteDescription,
  getSiteMode,
  getSiteName,
  getSiteUrlForMode,
} from './site'
import { getApiBase, getApiOrigin, getAuthBase, getCliSkillRegistryValue } from './env'

function withMetaEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const env = import.meta.env as unknown as Record<string, unknown>
  const previous = new Map<string, unknown>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, env[key])
    if (value === undefined) {
      delete env[key]
    } else {
      env[key] = value
    }
  }
  try {
    return run()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete env[key]
      else env[key] = value
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('site helpers', () => {
  it('returns default and env configured site URLs', () => {
    withMetaEnv({ VITE_SITE_URL: undefined }, () => {
      vi.stubEnv('SITE_URL', '')
      expect(getClawHubSiteUrl()).toBe('https://clawhub.ai')
    })
    withMetaEnv({ VITE_SITE_URL: 'https://example.com' }, () => {
      expect(getClawHubSiteUrl()).toBe('https://example.com')
    })
    withMetaEnv({ VITE_SITE_URL: 'https://clawhub.ai' }, () => {
      expect(getClawHubSiteUrl()).toBe('https://clawhub.ai')
    })
  })

  it('picks SoulHub URL from explicit env', () => {
    withMetaEnv({ VITE_SOULHUB_SITE_URL: 'https://souls.example.com' }, () => {
      expect(getOnlyCrabsSiteUrl()).toBe('https://souls.example.com')
    })
  })

  it('derives SoulHub URL from local VITE_SITE_URL', () => {
    withMetaEnv({ VITE_SOULHUB_SITE_URL: undefined, VITE_SITE_URL: 'http://localhost:3000' }, () => {
      expect(getOnlyCrabsSiteUrl()).toBe('http://localhost:3000')
    })
    withMetaEnv({ VITE_SOULHUB_SITE_URL: undefined, VITE_SITE_URL: 'http://127.0.0.1:3000' }, () => {
      expect(getOnlyCrabsSiteUrl()).toBe('http://127.0.0.1:3000')
    })
    withMetaEnv({ VITE_SOULHUB_SITE_URL: undefined, VITE_SITE_URL: 'http://0.0.0.0:3000' }, () => {
      expect(getOnlyCrabsSiteUrl()).toBe('http://0.0.0.0:3000')
    })
  })

  it('falls back to default SoulHub URL for invalid VITE_SITE_URL', () => {
    withMetaEnv({ VITE_SOULHUB_SITE_URL: undefined, VITE_SITE_URL: 'not a url' }, () => {
      expect(getOnlyCrabsSiteUrl()).toBe('https://onlycrabs.ai')
    })
  })

  it('detects site mode from host and URLs', () => {
    expect(detectSiteMode(null)).toBe('skills')

    withMetaEnv({ VITE_SOULHUB_HOST: 'souls.example.com' }, () => {
      expect(getOnlyCrabsHost()).toBe('souls.example.com')
      expect(detectSiteMode('souls.example.com')).toBe('souls')
      expect(detectSiteMode('sub.souls.example.com')).toBe('souls')
      expect(detectSiteMode('clawhub.ai')).toBe('skills')

      expect(detectSiteModeFromUrl('https://souls.example.com/x')).toBe('souls')
      expect(detectSiteModeFromUrl('souls.example.com')).toBe('souls')
      expect(detectSiteModeFromUrl('https://clawhub.ai')).toBe('skills')
    })
  })

  it('detects site mode from window when available', () => {
    withMetaEnv({ VITE_SOULHUB_HOST: 'onlycrabs.ai' }, () => {
      vi.stubGlobal('window', { location: { hostname: 'onlycrabs.ai' } } as unknown as Window)
      expect(getSiteMode()).toBe('souls')
    })
  })

  it('detects site mode from env on the server', () => {
    withMetaEnv({ VITE_SITE_MODE: 'souls', VITE_SOULHUB_HOST: 'onlycrabs.ai' }, () => {
      expect(getSiteMode()).toBe('souls')
    })
    withMetaEnv({ VITE_SITE_MODE: 'skills', VITE_SOULHUB_HOST: 'onlycrabs.ai' }, () => {
      expect(getSiteMode()).toBe('skills')
    })
  })

  it('detects site mode from VITE_SOULHUB_SITE_URL and SITE_URL fallback', () => {
    withMetaEnv(
      { VITE_SITE_MODE: undefined, VITE_SOULHUB_SITE_URL: 'https://onlycrabs.ai' },
      () => {
        expect(getSiteMode()).toBe('souls')
      },
    )

    withMetaEnv(
      { VITE_SITE_MODE: undefined, VITE_SOULHUB_SITE_URL: undefined, VITE_SITE_URL: undefined },
      () => {
        vi.stubEnv('SITE_URL', 'https://onlycrabs.ai')
        expect(getSiteMode()).toBe('souls')
      },
    )
  })

  it('derives site metadata from mode', () => {
    expect(getSiteName('skills')).toBe('OnionHub')
    expect(getSiteName('souls')).toBe('SoulHub')

    expect(getSiteDescription('skills')).toContain('OnionHub')
    expect(getSiteDescription('souls')).toContain('SoulHub')

    withMetaEnv({ VITE_SITE_URL: undefined, VITE_SOULHUB_SITE_URL: undefined }, () => {
      vi.stubEnv('SITE_URL', '')
      expect(getSiteUrlForMode('skills')).toBe('https://clawhub.ai')
      expect(getSiteUrlForMode('souls')).toBe('https://onlycrabs.ai')
    })
  })

  it('derives API-related values from VITE_API_ORIGIN', () => {
    withMetaEnv(
      {
        VITE_API_ORIGIN: 'https://api.example.com',
        VITE_API_BASE: undefined,
        VITE_AUTH_BASE_URL: undefined,
        VITE_CLI_SKILL_REGISTRY: undefined,
      },
      () => {
        expect(getApiOrigin()).toBe('https://api.example.com')
        expect(getApiBase()).toBe('https://api.example.com/api/v1')
        expect(getAuthBase()).toBe('https://api.example.com')
        expect(getCliSkillRegistryValue()).toBe('https://api.example.com')
      },
    )
  })

  it('uses VITE_API_BASE as the explicit browser API base', () => {
    withMetaEnv(
      {
        VITE_API_ORIGIN: 'https://api.example.com',
        VITE_API_BASE: '/custom/api',
        VITE_AUTH_BASE_URL: undefined,
      },
      () => {
        expect(getApiBase()).toBe('/custom/api')
        expect(getAuthBase()).toBe('https://api.example.com')
      },
    )
  })

  it('derives API origin from server runtime env', () => {
    withMetaEnv({ VITE_API_ORIGIN: undefined, VITE_API_BASE: undefined }, () => {
      vi.stubEnv('API_ORIGIN', 'https://server-api.example.com')
      vi.stubEnv('BACKEND_URL', 'https://backend.example.com')
      expect(getApiOrigin()).toBe('https://server-api.example.com')
      expect(getApiBase()).toBe('https://server-api.example.com/api/v1')
    })
  })

  it('ignores removed API aliases', () => {
    const oldApiBaseUrl = ['VITE_API', 'BASE_URL'].join('_')
    const oldBackendBase = ['VITE', 'BACKEND_BASE'].join('_')
    const oldConvexSiteUrl = ['VITE', 'CONVEX_SITE_URL'].join('_')
    withMetaEnv(
      {
        VITE_API_ORIGIN: undefined,
        VITE_API_BASE: undefined,
        [oldApiBaseUrl]: 'https://legacy.example.com/api/v1',
        [oldBackendBase]: 'https://backend-legacy.example.com',
        [oldConvexSiteUrl]: 'https://convex.example.com',
      },
      () => {
        vi.stubEnv('API_ORIGIN', '')
        vi.stubEnv('BACKEND_URL', '')
        expect(getApiOrigin()).toBeNull()
        expect(getApiBase()).toBe('/api/v1')
      },
    )
  })
})
