import { useInfiniteQuery } from "@tanstack/react-query";
import type { BundleListResponse } from "../types/api";
import { apiRequest } from "../lib/apiClient";

interface UseBundlesOptions {
  sort?: string;
  dir?: "asc" | "desc";
  limit?: number;
  category?: string;
  owner?: string;
  q?: string;
  enabled?: boolean;
}

export function useBundles(options: UseBundlesOptions = {}) {
  const {
    sort = "downloads",
    dir = "desc",
    limit = 25,
    category,
    owner,
    q,
    enabled = true,
  } = options;

  return useInfiniteQuery({
    queryKey: ["bundles", "list", { sort, dir, limit, category, owner, q }],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(limit),
      });

      if (pageParam) params.set("cursor", pageParam as string);
      if (sort) params.set("sort", sort);
      if (dir) params.set("dir", dir);
      if (category) params.set("category", category);
      if (owner) params.set("owner", owner);
      if (q) params.set("q", q);

      return apiRequest<BundleListResponse>(`/bundles?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled,
  });
}
