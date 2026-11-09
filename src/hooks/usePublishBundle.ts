import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PublishBundlePayload, PublishBundleResponse } from "../types/api";
import { apiClient } from "../lib/api-client";

export function usePublishBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PublishBundlePayload) =>
      apiClient.post<PublishBundleResponse>("/bundles", payload),
    onSuccess: (data, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["bundles", "list"] });
      void queryClient.invalidateQueries({
        queryKey: ["bundles", "detail", payload.slug],
      });
      void queryClient.invalidateQueries({ queryKey: ["my", "bundles"] });
    },
  });
}
