import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import type { Page, PageElementWithItems } from "@ww/types";

import { useElementComments, usePostComment } from "../api/comments.js";
import { usePageReviews } from "../api/reviews.js";
import { displayName, useProfiles } from "../api/profiles.js";
import { pageByTagQueryKey } from "../api/queries.js";
import { BackLink } from "../components/BackLink.js";
import { Container } from "../components/Container.js";
import { ElementContent } from "../components/page/PageElementsList.js";
import { useAuth } from "../lib/auth/AuthProvider.js";
import { formatRelativeTime } from "../lib/relativeTime.js";
import { supabase } from "../lib/supabase.js";

async function fetchPageByTag(tag: string): Promise<Page | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("tag", tag)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchPageElements(
  pageId: string,
): Promise<PageElementWithItems[]> {
  const { data, error } = await supabase
    .from("page_elements")
    .select("*, items:page_element_items(*)")
    .eq("page_id", pageId)
    .order("position", { ascending: true })
    .order("position", {
      ascending: true,
      referencedTable: "page_element_items",
    });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const items = (row.items ?? []) as PageElementWithItems["items"];
    return {
      ...row,
      items: [...items].sort((a, b) => a.position - b.position),
    };
  });
}

export function CommentsView() {
  const { tag = "", elementId = "" } = useParams<{
    tag: string;
    elementId: string;
  }>();
  const { accessToken } = useAuth();
  const postComment = usePostComment(accessToken);
  const [body, setBody] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageQuery = useQuery({
    queryKey: pageByTagQueryKey(tag),
    queryFn: () => fetchPageByTag(tag),
    enabled: Boolean(tag),
  });

  const page = pageQuery.data;

  const elementsQuery = useQuery({
    queryKey: page ? ["page-elements", page.id] : ["page-elements", "none"],
    queryFn: () => fetchPageElements(page!.id),
    enabled: Boolean(page),
  });

  const element = useMemo(
    () => elementsQuery.data?.find((row) => row.id === elementId),
    [elementId, elementsQuery.data],
  );

  const { byItemId } = usePageReviews(page?.id);
  const commentsQuery = useElementComments(page?.id, element?.id);
  const comments = commentsQuery.data ?? [];

  const authorIds = useMemo(
    () => [...new Set(comments.map((row) => row.user_id))],
    [comments],
  );
  const { getProfile } = useProfiles(authorIds);

  function scrollToBottomIfNear() {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance < 120) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  useEffect(() => {
    scrollToBottomIfNear();
  }, [comments.length]);

  async function onSend() {
    const trimmed = body.trim();
    if (!trimmed || !page || !element) {
      return;
    }

    await postComment.mutateAsync({
      pageId: page.id,
      elementId: element.id,
      body: { body: trimmed },
    });
    setBody("");
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const notFound =
    !pageQuery.isLoading &&
    !elementsQuery.isLoading &&
    (Boolean(pageQuery.error) ||
      !page ||
      !element ||
      element.type === "section");

  return (
    <Container className="flex min-h-screen flex-col pb-6">
      <BackLink to={`/${tag}`} />

      {pageQuery.isLoading || elementsQuery.isLoading ? (
        <p className="text-muted mt-10 text-sm">Loading</p>
      ) : notFound ? (
        <div className="mt-10 space-y-2">
          <h1 className="font-serif text-3xl">Not found</h1>
          <p className="text-muted text-sm">
            This element does not exist or cannot be commented on.
          </p>
        </div>
      ) : element ? (
        <>
          <div className="mt-8 min-h-0 flex-1">
            <div className="mb-8">
              <ElementContent
                element={element}
                pageId={page!.id}
                viewMode
                byItemId={byItemId}
              />
            </div>

            <div
              ref={scrollRef}
              className="max-h-[50vh] space-y-4 overflow-y-auto pr-1"
            >
              {comments.map((comment) => {
                const profile = getProfile(comment.user_id);
                const name = profile
                  ? displayName(profile)
                  : displayName(profile, { loading: true });
                return (
                  <article key={comment.id} className="">
                    <div className="flex w-full items-baseline justify-between text-sm">
                      <span className="font-serif font-semibold">
                        {name || "\u00a0"}
                      </span>
                      <time
                        className="text-muted shrink-0"
                        dateTime={comment.created_at}
                      >
                        {formatRelativeTime(comment.created_at)}
                      </time>
                    </div>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  </article>
                );
              })}
              <div ref={listEndRef} />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSend();
                }
              }}
              rows={1}
              placeholder="Write a comment"
              className="bg-surface text-foreground placeholder:text-muted min-h-[2.75rem] min-w-0 flex-1 resize-y rounded-xs px-3 py-2 text-base outline-none"
            />
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={postComment.isPending || !body.trim()}
              className="text-foreground hover:text-muted disabled:text-muted/40 shrink-0 self-end p-2"
              aria-label="Send comment"
            >
              <PaperPlaneRightIcon size={24} weight="fill" />
            </button>
          </div>
        </>
      ) : null}
    </Container>
  );
}
