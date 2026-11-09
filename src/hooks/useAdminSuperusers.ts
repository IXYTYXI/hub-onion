import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAdminSuperuser,
  fetchAdminSuperusers,
  removeAdminSuperuser,
  syncAdminSuperuserCache,
} from "../lib/apiAdminSuperusers";

export const adminSuperusersQueryKey = ["admin", "superusers"] as const;

export function useAdminSuperusers(enabled: boolean) {
  return useQuery({
    queryKey: adminSuperusersQueryKey,
    queryFn: fetchAdminSuperusers,
    enabled,
    retry: false,
  });
}

export function useAddAdminSuperuser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addAdminSuperuser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminSuperusersQueryKey });
    },
  });
}

export function useRemoveAdminSuperuser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeAdminSuperuser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminSuperusersQueryKey });
    },
  });
}

export function useSyncAdminSuperuserCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncAdminSuperuserCache,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminSuperusersQueryKey });
    },
  });
}
