import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";
import type { BundleListResponse } from "../types/api";

type UseMyBundlesOptions = {
  limit?: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
  enabled?: boolean;
};

export function useMyBundles(options: UseMyBundlesOptions = {}) {
  const { limit = 6, sort = "updated", dir = "desc", q, enabled = true } = options;

  return useQuery({
    queryKey: ["my", "bundles", { limit, sort, dir, q }],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        sort,
        dir,
      });
      if (q?.trim()) params.set("q", q.trim());
      return apiRequest<BundleListResponse>(`/my/bundles?${params.toString()}`);
    },
    enabled,
  });
}
