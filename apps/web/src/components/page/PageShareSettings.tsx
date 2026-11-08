import {
  CheckIcon,
  CopyIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import type { Page } from "@ww/types";

import { useAddPageMember, useRemovePageMember } from "../../api/members.js";
import { pagesQueryKey } from "../../api/queries.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";
import { supabase } from "../../lib/supabase.js";
import { Button } from "../Button.js";
import { TextField } from "../TextField.js";

type PageMemberRow = {
  user_id: string;
  created_at: string;
  profiles: { first_name: string } | null;
};

type PageShareSettingsProps = {
  page: Page;
  accessToken: string;
};

export function PageShareSettings({ page, accessToken }: PageShareSettingsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const addMember = useAddPageMember(accessToken);
  const removeMember = useRemovePageMember(accessToken);

  const [email, setEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const inviteUrl = `${window.location.origin}/join/${page.invite_token}`;

  const membersQuery = useQuery({
    queryKey: ["page-members", page.id],
    queryFn: async (): Promise<PageMemberRow[]> => {
      const { data, error } = await supabase
        .from("page_members")
        .select("user_id, created_at, profiles!page_members_user_id_fkey(first_name)")
        .eq("page_id", page.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as PageMemberRow[];
    },
  });

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  async function onAddMember(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }

    try {
      await addMember.mutateAsync({
        pageId: page.id,
        body: { email: trimmed },
      });
      setEmail("");
      await membersQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not add member";
      setAddError(message);
    }
  }

  async function onRemoveMember(userId: string, name: string) {
    const confirmed = window.confirm(`Remove ${name} from this page?`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await removeMember.mutateAsync({ pageId: page.id, userId });
      await membersQuery.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not remove member";
      setActionError(message);
    }
  }

  async function onLeavePage() {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Leave this page? You can rejoin with the invite link.");
    if (!confirmed) {
      return;
    }

    setActionError(null);
    try {
      await removeMember.mutateAsync({ pageId: page.id, userId: user.id });
      await queryClient.invalidateQueries({ queryKey: pagesQueryKey });
      navigate("/", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not leave page";
      setActionError(message);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium">Invite link</p>
        <div className="flex items-center gap-3">
          <p className="text-muted min-w-0 flex-1 truncate text-sm">{inviteUrl}</p>
          <button
            type="button"
            onClick={() => void onCopyLink()}
            className="text-muted hover:text-foreground shrink-0 p-1"
            aria-label="Copy link"
          >
            {copied ? (
              <CheckIcon size={18} weight="bold" />
            ) : (
              <CopyIcon size={18} weight="bold" />
            )}
          </button>
        </div>
      </div>

      <form className="space-y-3" onSubmit={(event) => void onAddMember(event)}>
        <TextField
          label="Add by email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
        {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
        <Button
          type="submit"
          variant="primary"
          width="full"
          disabled={addMember.isPending || email.trim().length === 0}
        >
          {addMember.isPending ? "Adding" : "Add"}
        </Button>
      </form>

      <div className="space-y-4">
        <p className="text-sm font-medium">Members</p>
        {membersQuery.isLoading ? (
          <p className="text-muted text-sm">Loading</p>
        ) : (
          <ul className="space-y-4">
            {(membersQuery.data ?? []).map((member) => {
              const firstName =
                member.profiles?.first_name?.trim() || "Unknown";
              const isSelf = member.user_id === user?.id;

              return (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm">
                    {firstName}
                    {isSelf ? (
                      <span className="text-muted ml-2 font-normal">You</span>
                    ) : null}
                  </span>
                  {!isSelf ? (
                    <button
                      type="button"
                      onClick={() => void onRemoveMember(member.user_id, firstName)}
                      className="text-muted hover:text-foreground p-1"
                      aria-label={`Remove ${firstName}`}
                      disabled={removeMember.isPending}
                    >
                      <UserMinusIcon size={18} weight="bold" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      <button
        type="button"
        onClick={() => void onLeavePage()}
        className="text-muted hover:text-foreground text-sm"
        disabled={removeMember.isPending}
      >
        Leave page
      </button>
    </div>
  );
}
