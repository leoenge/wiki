import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchInvitePreview, joinPageByInvite } from "../api/invites.js";
import { pagesQueryKey } from "../api/queries.js";
import { buttonStyles } from "../components/Button.js";
import { Container } from "../components/Container.js";
import { useAuth } from "../lib/auth/AuthProvider.js";

const PENDING_INVITE_KEY = "ww.pendingInvite";

export function JoinView() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem(PENDING_INVITE_KEY, token);
    }
  }, [token]);

  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => fetchInvitePreview(token),
    enabled: Boolean(token) && !user && !authLoading,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => joinPageByInvite(token, accessToken!),
    onSuccess: (page) => {
      localStorage.removeItem(PENDING_INVITE_KEY);
      void queryClient.invalidateQueries({ queryKey: pagesQueryKey });
      navigate(`/${page.tag}`, { replace: true });
    },
    onError: (error: Error) => {
      setJoinError(error.message);
    },
  });

  const joinedRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user || !accessToken || !token || joinedRef.current) {
      return;
    }
    joinedRef.current = true;
    joinMutation.mutate();
  }, [authLoading, user, accessToken, token, joinMutation.mutate]);

  if (authLoading) {
    return (
      <Container className="min-h-screen py-16">
        <p className="text-muted text-sm">Loading</p>
      </Container>
    );
  }

  if (user) {
    return (
      <Container className="min-h-screen py-16">
        <p className="text-muted text-sm">
          {joinMutation.isPending ? "Joining" : "Almost there"}
        </p>
        {joinError ? (
          <p className="mt-4 text-sm text-red-600">{joinError}</p>
        ) : null}
      </Container>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <Container className="min-h-screen py-16">
        <p className="text-muted text-sm">Loading</p>
      </Container>
    );
  }

  if (previewQuery.isError) {
    return (
      <Container className="min-h-screen space-y-4 py-16">
        <h1 className="text-3xl">Invite not found</h1>
        <p className="text-muted text-sm leading-relaxed">
          This link may have expired or the page was removed.
        </p>
        <Link to="/" className="text-sm font-medium">
          Go home
        </Link>
      </Container>
    );
  }

  const pageName = previewQuery.data?.page_name ?? "a page";
  const returnPath = `/join/${token}`;

  return (
    <Container className="flex min-h-screen flex-col justify-center gap-10 py-16">
      <div className="space-y-3">
        <h1 className="text-4xl tracking-tight">You were invited</h1>
        <p className="text-muted text-sm leading-relaxed">
          Join {pageName} on Wiki. Sign in or create an account to continue.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/auth"
          state={{ from: returnPath }}
          className={buttonStyles({ variant: "primary", width: "full" })}
        >
          Sign in
        </Link>
        <Link
          to="/auth?mode=sign-up"
          state={{ from: returnPath }}
          className={buttonStyles({ variant: "secondary", width: "full" })}
        >
          Create account
        </Link>
      </div>
    </Container>
  );
}
