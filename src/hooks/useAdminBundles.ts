import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";
import type { BundleItem, BundleListResponse } from "../types/api";

export type AdminBundleStatus = "all" | "active" | "deleted";

export type AdminBundleListEntry = {
  bundle: BundleItem;
  status: "active" | "deleted";
  isDeleted: boolean;
};

type UseAdminBundlesOptions = {
  status?: AdminBundleStatus;
  q?: string;
  enabled?: boolean;
};

async function fetchAdminBundleList(status: "active" | "deleted", q?: string) {
  const params = new URLSearchParams({
    status,
    sort: "updated",
    dir: "desc",
    limit: "100",
  });
  if (q?.trim()) params.set("q", q.trim());
  const response = await apiRequest<BundleListResponse>(`/admin/bundles?${params.toString()}`);
  return (response.items ?? []).map((bundle) => ({
    bundle,
    status,
    isDeleted: status === "deleted",
  }));
}

export function useAdminBundles(options: UseAdminBundlesOptions = {}) {
  const { status = "all", q, enabled = true } = options;

  return useQuery({
    queryKey: ["admin", "bundles", status, q],
    queryFn: async () => {
      if (status === "active" || status === "deleted") {
        return { items: await fetchAdminBundleList(status, q) };
      }

      const [active, deleted] = await Promise.all([
        fetchAdminBundleList("active", q),
        fetchAdminBundleList("deleted", q),
      ]);
      return { items: [...active, ...deleted] };
    },
    enabled,
    retry: false,
  });
}
