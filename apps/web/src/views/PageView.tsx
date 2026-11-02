import { Plus } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import type { Page, PageElement } from "@ww/types";
import { getLastRootSectionId } from "@ww/types";

import { useCreateElement } from "../api/elements.js";
import { useUpdatePage } from "../api/pages.js";
import { pageByTagQueryKey, pageElementsQueryKey } from "../api/queries.js";
import { BackLink } from "../components/BackLink.js";
import { Container } from "../components/Container.js";
import { ImagePicker } from "../components/ImagePicker.js";
import { AddElementDialog } from "../components/page/AddElementDialog.js";
import { AddImageDialog } from "../components/page/AddImageDialog.js";
import { PageElementsList } from "../components/page/PageElementsList.js";
import { useAuth } from "../lib/auth/AuthProvider.js";
import { uploadImage } from "../lib/images.js";
import { supabase } from "../lib/supabase.js";
import { useImageUrl } from "../lib/useImageUrl.js";

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

async function fetchPageElements(pageId: string): Promise<PageElement[]> {
  const { data, error } = await supabase
    .from("page_elements")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

function MainImageBlock({
  path,
  uploading,
  onPick,
}: {
  path: string | null;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  const urlQuery = useImageUrl(path);

  return (
    <div>
      <ImagePicker
        previewUrl={path ? urlQuery.data : null}
        onPick={onPick}
        aspect="square"
      />
      {uploading ? <p className="text-muted mt-2 text-xs">Uploading</p> : null}
    </div>
  );
}

type AddContentButtonProps = {
  onClick: () => void;
};

function AddContentButton({ onClick }: AddContentButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface/50 text-foreground/80 inline-flex w-full items-center justify-center gap-2 rounded-lg py-12 text-xl"
    >
      <Plus size={24} />
      Add
    </button>
  );
}

export function PageView() {
  const { tag = "" } = useParams<{ tag: string }>();
  const { user, accessToken } = useAuth();
  const updatePage = useUpdatePage(accessToken);
  const createElement = useCreateElement(accessToken);

  const [chooseElementOpen, setChooseElementOpen] = useState(false);
  const [addImageOpen, setAddImageOpen] = useState(false);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<
    Record<string, true>
  >({});
  const [addTargetSectionId, setAddTargetSectionId] = useState<string | null>(
    null,
  );
  const [imageSubmitting, setImageSubmitting] = useState(false);
  const [mainUploading, setMainUploading] = useState(false);

  const pageQuery = useQuery({
    queryKey: pageByTagQueryKey(tag),
    queryFn: () => fetchPageByTag(tag),
    enabled: Boolean(user && tag),
  });

  const page = pageQuery.data;

  const elementsQuery = useQuery({
    queryKey: page ? pageElementsQueryKey(page.id) : ["page-elements", "none"],
    queryFn: () => fetchPageElements(page!.id),
    enabled: Boolean(page),
  });

  const elements = elementsQuery.data ?? [];

  const lastRootSectionId = useMemo(
    () => getLastRootSectionId(elements),
    [elements],
  );

  useEffect(() => {
    setCollapsedSectionIds((previous) => {
      const sectionIds = new Set(
        elements
          .filter((element) => element.type === "section")
          .map((element) => element.id),
      );
      const next = { ...previous };
      let changed = false;

      for (const id of Object.keys(next)) {
        if (!sectionIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [elements]);

  useEffect(() => {
    if (
      addTargetSectionId &&
      elements.some(
        (element) =>
          element.id === addTargetSectionId && element.type === "section",
      )
    ) {
      return;
    }

    setAddTargetSectionId(lastRootSectionId);
  }, [elements, lastRootSectionId, addTargetSectionId]);

  function toggleSectionCollapsed(sectionId: string) {
    setCollapsedSectionIds((previous) => {
      if (previous[sectionId]) {
        const next = { ...previous };
        delete next[sectionId];
        return next;
      }
      return { ...previous, [sectionId]: true };
    });
  }

  function addTargetSectionIdForContent(): string | undefined {
    if (
      addTargetSectionId &&
      elements.some(
        (element) =>
          element.id === addTargetSectionId && element.type === "section",
      )
    ) {
      return addTargetSectionId;
    }
    return undefined;
  }

  async function onMainImagePick(file: File) {
    if (!user || !page) {
      return;
    }

    setMainUploading(true);
    try {
      const path = await uploadImage(user.id, file);
      await updatePage.mutateAsync({
        pageId: page.id,
        body: { main_image_path: path },
      });
    } finally {
      setMainUploading(false);
    }
  }

  async function onAddTextElement() {
    if (!page) {
      return;
    }

    await createElement.mutateAsync({
      pageId: page.id,
      body: {
        type: "text",
        text: "",
        target_section_id: addTargetSectionIdForContent(),
      },
    });
  }

  async function onAddSectionElement() {
    if (!page) {
      return;
    }

    const section = await createElement.mutateAsync({
      pageId: page.id,
      body: { type: "section", text: "" },
    });

    const rootSections = elements.filter(
      (element) => element.type === "section" && element.parent_id === null,
    );
    const nextCollapsed: Record<string, true> = {};
    for (const existing of rootSections) {
      nextCollapsed[existing.id] = true;
    }
    setCollapsedSectionIds(nextCollapsed);
    setAddTargetSectionId(section.id);
  }

  async function onAddImageElement(payload: { file: File; caption: string }) {
    if (!user || !page) {
      return;
    }

    setImageSubmitting(true);
    try {
      const path = await uploadImage(user.id, payload.file);
      await createElement.mutateAsync({
        pageId: page.id,
        body: {
          type: "image",
          image_path: path,
          caption: payload.caption,
          target_section_id: addTargetSectionIdForContent(),
        },
      });
      setAddImageOpen(false);
    } finally {
      setImageSubmitting(false);
    }
  }

  return (
    <Container className="min-h-screen">
      <BackLink to="/" />

      {pageQuery.isLoading ? (
        <p className="text-muted mt-10 text-sm">Loading</p>
      ) : pageQuery.error ? (
        <p className="mt-10 text-sm text-red-600">Could not load page</p>
      ) : !page ? (
        <div className="mt-10 space-y-2">
          <h1 className="text-3xl">Not found</h1>
          <p className="text-muted text-sm">
            This page does not exist or you do not have access.
          </p>
        </div>
      ) : (
        <>
          <header className="mt-8 space-y-2">
            <h1 className="text-4xl tracking-tight">{page.name}</h1>
            <p className="text-muted text-sm">/{page.tag}</p>
          </header>

          <div className="mt-10">
            <MainImageBlock
              path={page.main_image_path}
              uploading={mainUploading}
              onPick={(file) => void onMainImagePick(file)}
            />
          </div>

          <section className="mt-10">
            <PageElementsList
              pageId={page.id}
              elements={elements}
              accessToken={accessToken}
              collapsedSectionIds={collapsedSectionIds}
              onToggleSectionCollapsed={toggleSectionCollapsed}
            />
          </section>

          <div className="mt-10">
            <AddContentButton onClick={() => setChooseElementOpen(true)} />
          </div>
        </>
      )}

      <AddElementDialog
        open={chooseElementOpen}
        onClose={() => setChooseElementOpen(false)}
        onChooseImage={() => setAddImageOpen(true)}
        onChooseText={() => void onAddTextElement()}
        onChooseSection={() => void onAddSectionElement()}
      />

      <AddImageDialog
        open={addImageOpen}
        onClose={() => setAddImageOpen(false)}
        submitting={imageSubmitting}
        onSubmit={(payload) => void onAddImageElement(payload)}
      />
    </Container>
  );
}
