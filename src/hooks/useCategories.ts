import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/apiClient'
import type { CategoryListResponse } from '../types/api'

export function useCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['categories', 'list'],
    queryFn: async () => (await apiRequest<CategoryListResponse>('/categories')) ?? { items: [] },
    enabled: options?.enabled ?? true,
  })
}
