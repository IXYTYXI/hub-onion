import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

interface DeleteBundleResponse {
  ok: string;
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => apiClient.delete<DeleteBundleResponse>(`/bundles/${slug}`),
    onSuccess: (data, slug) => {
      void queryClient.invalidateQueries({ queryKey: ["bundles", "list"] });
      void queryClient.invalidateQueries({
        queryKey: ["bundles", "detail", slug],
      });
      void queryClient.invalidateQueries({ queryKey: ["my", "bundles"] });
    },
  });
}
