import { useQuery } from "@tanstack/react-query";
import type { BundleDetailResponse } from "../types/api";
import { apiRequest } from "../lib/apiClient";

export function useBundle(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["bundles", "detail", slug],
    queryFn: () => apiRequest<BundleDetailResponse>(`/bundles/${slug}`),
    enabled: options?.enabled ?? Boolean(slug),
  });
}
