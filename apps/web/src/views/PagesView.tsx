import { SignOutIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import type { Page } from "@ww/types";

import { pagesQueryKey } from "../api/queries.js";
import { Button, buttonStyles } from "../components/Button.js";
import { Container } from "../components/Container.js";
import { useAuth } from "../lib/auth/AuthProvider.js";
import { supabase } from "../lib/supabase.js";

async function fetchPages(): Promise<Page[]> {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export function PagesView() {
  const { user, signOut } = useAuth();

  const pagesQuery = useQuery({
    queryKey: pagesQueryKey,
    queryFn: fetchPages,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Container className="flex min-h-screen flex-col justify-center gap-8">
        <div className="space-y-3">
          <h1 className="text-4xl tracking-tight">Your wiki pages</h1>
          <p className="text-muted text-sm leading-relaxed">
            Sign in to create pages about yourself and the people you care
            about.
          </p>
        </div>
        <Link to="/auth" className={buttonStyles({ variant: "primary" })}>
          Sign in
        </Link>
      </Container>
    );
  }

  return (
    <Container className="min-h-screen pb-16">
      <header className="mb-12 flex items-start justify-between gap-4">
        <h1 className="text-4xl tracking-tight">My Pages</h1>
        <Link
          to="/create"
          className={buttonStyles({ variant: "anonymous" })}
        >
          Create
        </Link>
      </header>

      <section className="space-y-8">
        {pagesQuery.isLoading ? (
          <p className="text-muted text-sm">Loading pages</p>
        ) : pagesQuery.error ? (
          <p className="text-sm text-red-600">Could not load pages</p>
        ) : pagesQuery.data?.length === 0 ? (
          <p className="text-muted text-sm">No pages yet</p>
        ) : (
          <ul className="space-y-8">
            {pagesQuery.data?.map((page) => (
              <li key={page.id}>
                <Link to={`/${page.tag}`} className="block space-y-1">
                  <span className="font-serif text-2xl">{page.name}</span>
                  <span className="text-muted block text-sm">/{page.tag}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16">
        <Button
          type="button"
          variant="anonymous"
          className="text-muted hover:text-foreground gap-1.5"
          onClick={() => void signOut()}
        >
          <SignOutIcon size={16} />
          Sign out
        </Button>
      </div>
    </Container>
  );
}
