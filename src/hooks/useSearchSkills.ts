import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/apiClient'
import type { SearchResponse } from '../types/api'

export function useSearchSkills(query: string, options?: { enabled?: boolean; category?: string }) {
  const trimmedQuery = query.trim()
  const category = options?.category

  return useQuery({
    queryKey: ['skills', 'search', trimmedQuery, { category }],
    queryFn: () => {
      const params = new URLSearchParams({ q: trimmedQuery })
      if (category) params.set('category', category)
      return apiRequest<SearchResponse>(`/search?${params}`)
    },
    enabled: (options?.enabled ?? true) && trimmedQuery.length > 0,
  })
}
