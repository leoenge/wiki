import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import type { Profile } from "@ww/types";

import { supabase } from "../lib/supabase.js";

export function profileQueryKey(id: string) {
  return ["profile", id] as const;
}

function profilesBatchQueryKey(ids: string[]) {
  return ["profiles", "batch", ids] as const;
}

async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function displayName(
  profile: Profile | null | undefined,
  options?: { loading?: boolean },
): string {
  if (!profile) {
    return options?.loading ? "" : "Unknown";
  }
  return profile.first_name;
}

export function useProfiles(ids: string[]) {
  const queryClient = useQueryClient();
  const uniqueIds = useMemo(
    () => [...new Set(ids.filter(Boolean))].sort(),
    [ids],
  );
  const batchKey = useMemo(() => profilesBatchQueryKey(uniqueIds), [uniqueIds]);

  const batchQuery = useQuery({
    queryKey: batchKey,
    queryFn: () => fetchProfilesByIds(uniqueIds),
    enabled: uniqueIds.length > 0,
  });

  useEffect(() => {
    if (!batchQuery.data) {
      return;
    }
    for (const profile of batchQuery.data) {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    }
  }, [batchQuery.data, queryClient]);

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of batchQuery.data ?? []) {
      map.set(profile.id, profile);
    }
    return map;
  }, [batchQuery.data]);

  function getProfile(id: string | undefined | null): Profile | undefined {
    if (!id) {
      return undefined;
    }
    return (
      profilesById.get(id) ??
      queryClient.getQueryData<Profile>(profileQueryKey(id))
    );
  }

  return {
    getProfile,
    isLoading: batchQuery.isLoading,
    isFetching: batchQuery.isFetching,
  };
}
