import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/apiClient";

export function useAdminBundleAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, type }: { slug: string; type: "delete" | "undelete" }) =>
      apiRequest(`/admin/bundles/${encodeURIComponent(slug)}/${type === "delete" ? "delete" : "undelete"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bundles"] });
      await queryClient.invalidateQueries({ queryKey: ["bundles", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["bundles", "detail", variables.slug] });
      await queryClient.invalidateQueries({ queryKey: ["my", "bundles"] });
    },
  });
}

export function useAdminBundleCategoriesAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, categorySlugs }: { slug: string; categorySlugs: string[] }) =>
      apiRequest(`/admin/bundles/${encodeURIComponent(slug)}/categories`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorySlugs }),
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "bundles"] });
      await queryClient.invalidateQueries({ queryKey: ["bundles", "list"] });
      await queryClient.invalidateQueries({ queryKey: ["bundles", "detail", variables.slug] });
      await queryClient.invalidateQueries({ queryKey: ["my", "bundles"] });
    },
  });
}
