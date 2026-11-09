import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

interface UndeleteBundleResponse {
  ok: string;
}

export function useUndeleteBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) =>
      apiClient.post<UndeleteBundleResponse>(`/bundles/${encodeURIComponent(slug)}/undelete`, {}),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({ queryKey: ["bundles", "list"] });
      void queryClient.invalidateQueries({
        queryKey: ["bundles", "detail", slug],
      });
      void queryClient.invalidateQueries({ queryKey: ["my", "bundles"] });
    },
  });
}
