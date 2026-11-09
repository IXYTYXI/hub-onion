import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DocumentationLink } from "../types/api";
import { apiClient } from "../lib/api-client";
import { getPublishFileEntries } from "../lib/publishPaths";

interface PublishPayload {
  slug: string;
  displayName: string;
  version: string;
  changelog: string;
  tags?: string[];
  categorySlugs?: string[];
  documentationLinks?: DocumentationLink[];
  source?: Record<string, unknown>;
  forkOf?: {
    slug: string;
    version?: string;
  };
}

interface PublishResponse {
  ok: string;
  skillId: string;
  versionId: string;
}

interface PublishSkillInput {
  payload: PublishPayload;
  files: File[];
}

export function usePublishSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ payload, files }: PublishSkillInput) => {
      const formData = new FormData();

      // Add payload as JSON
      formData.append("payload", JSON.stringify(payload));

      // Add files with normalized package-relative paths.
      getPublishFileEntries(files).forEach(({ file, path }) => {
        formData.append("files", file, path);
      });

      return apiClient.postMultipart<PublishResponse>("/skills", formData);
    },
    onSuccess: (data, variables) => {
      // Invalidate skills list to refetch
      void queryClient.invalidateQueries({ queryKey: ["skills", "list"] });

      // Invalidate specific skill detail if updating
      void queryClient.invalidateQueries({
        queryKey: ["skills", "detail", variables.payload.slug],
      });

      // Invalidate versions list
      void queryClient.invalidateQueries({
        queryKey: ["skills", "versions", variables.payload.slug],
      });

      // Invalidate search results
      void queryClient.invalidateQueries({ queryKey: ["skills", "search"] });
    },
  });
}
