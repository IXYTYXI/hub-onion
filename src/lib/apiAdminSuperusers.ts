import type { DynamicSuperuser, SuperuserCacheSyncResponse, SuperuserListResponse } from "../types/api";
import { apiRequest } from "./apiClient";

export function fetchAdminSuperusers() {
  return apiRequest<SuperuserListResponse>("/admin/superusers");
}

export function addAdminSuperuser(email: string) {
  return apiRequest<DynamicSuperuser>("/admin/superusers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function removeAdminSuperuser(email: string) {
  return apiRequest(`/admin/superusers?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}

export function syncAdminSuperuserCache() {
  return apiRequest<SuperuserCacheSyncResponse>("/admin/superusers/sync-cache", {
    method: "POST",
  });
}
