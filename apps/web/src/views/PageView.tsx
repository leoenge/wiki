import { PencilSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useBlocker, useParams } from "react-router-dom";

import type { Page, PageDraftContent, PageElement } from "@ww/types";
import { pageDraftContentSchema } from "@ww/types";

import {
  useDiscardPageDraft,
  usePageDraft,
  usePublishPageDraft,
} from "../api/drafts.js";
import { pageByTagQueryKey, pageElementsQueryKey } from "../api/queries.js";
import { BackLink } from "../components/BackLink.js";
import { Container } from "../components/Container.js";
import { ImagePicker } from "../components/ImagePicker.js";
import { AddElementDialog } from "../components/page/AddElementDialog.js";
import { AddImageDialog } from "../components/page/AddImageDialog.js";
import { PageElementsList } from "../components/page/PageElementsList.js";
import { useDraftEditor } from "../hooks/useDraftEditor.js";
import { useAuth } from "../lib/auth/AuthProvider.js";
import { mapWithConcurrency, uploadImage } from "../lib/images.js";
import type { AddImageItem } from "../components/page/AddImageDialog.js";
import { supabase } from "../lib/supabase.js";
import { useImageUrl } from "../lib/useImageUrl.js";
import { StorageImage } from "../components/StorageImage.js";

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

function parseDraftContent(raw: unknown): PageDraftContent | null {
  const parsed = pageDraftContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function MainImageBlock({
  path,
  editable,
  uploading,
  onPick,
}: {
  path: string | null;
  editable: boolean;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  const urlQuery = useImageUrl(path);

  if (!editable) {
    if (!path) {
      return null;
    }

    return (
      <StorageImage
        path={path}
        className="aspect-square w-full rounded-xs object-cover"
      />
    );
  }

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

type PageTopBarProps = {
  isEditing: boolean;
  onEnterEdit: () => void;
  onDiscard: () => void;
  onPublish: () => void;
  publishing: boolean;
  discarding: boolean;
};

function PageTopBar({
  isEditing,
  onEnterEdit,
  onDiscard,
  onPublish,
  publishing,
  discarding,
}: PageTopBarProps) {
  if (isEditing) {
    return (
      <div className="flex items-center justify-end gap-6">
        <button
          type="button"
          onClick={onDiscard}
          disabled={discarding || publishing}
          className="text-muted hover:text-foreground text-sm disabled:opacity-50"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || discarding}
          className="bg-surface-strong/80 text-foreground/80 rounded-xs px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {publishing ? "Publishing" : "Publish changes"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <BackLink to="/" />
      <button
        type="button"
        onClick={onEnterEdit}
        className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <PencilSimpleIcon size={16} />
        Edit
      </button>
    </div>
  );
}

type LoadedPageProps = {
  page: Page;
  liveElements: PageElement[];
  accessToken: string;
  userId: string;
};

function LoadedPageView({
  page,
  liveElements,
  accessToken,
  userId,
}: LoadedPageProps) {
  const { tag } = useParams<{ tag: string }>();
  const draftQuery = usePageDraft(page.id);
  const publishDraft = usePublishPageDraft(accessToken, tag ?? page.tag);
  const discardDraft = useDiscardPageDraft(accessToken);

  const draftContent = useMemo(
    () => (draftQuery.data ? parseDraftContent(draftQuery.data.content) : null),
    [draftQuery.data],
  );

  const [isEditing, setIsEditing] = useState(false);
  const [chooseElementOpen, setChooseElementOpen] = useState(false);
  const [addImageOpen, setAddImageOpen] = useState(false);
  const [insertFlatIndex, setInsertFlatIndex] = useState(0);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<
    Record<string, true>
  >({});
  const [imageSubmitting, setImageSubmitting] = useState(false);
  const [mainUploading, setMainUploading] = useState(false);

  useEffect(() => {
    if (draftContent) {
      setIsEditing(true);
    }
  }, [draftContent]);

  const editor = useDraftEditor({
    page,
    liveElements,
    liveMainImagePath: page.main_image_path,
    draftContent,
    isEditing,
    accessToken,
  });

  useBlocker(isEditing);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isEditing]);

  const displayElements = isEditing ? editor.elements : liveElements;
  const displayMainImagePath = isEditing
    ? editor.mainImagePath
    : page.main_image_path;

  useEffect(() => {
    setCollapsedSectionIds((previous) => {
      const sectionIds = new Set(
        displayElements
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
  }, [displayElements]);

  function openAddMenuAtFlatIndex(flatIndex: number) {
    setInsertFlatIndex(flatIndex);
    setChooseElementOpen(true);
  }

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

  async function onMainImagePick(file: File) {
    setMainUploading(true);
    try {
      const { path, meta } = await uploadImage(userId, file);
      editor.setMainImage(path, {
        taken_at: meta.taken_at,
        latitude: meta.latitude,
        longitude: meta.longitude,
      });
    } finally {
      setMainUploading(false);
    }
  }

  function onAddTextElement() {
    editor.addTextElementAt(insertFlatIndex);
  }

  function onAddMapElement() {
    editor.addMapElementAt(insertFlatIndex);
  }

  function onAddSectionElement() {
    const section = editor.addSectionElementAt(insertFlatIndex);
    const rootSections = displayElements.filter(
      (element) => element.type === "section" && element.parent_id === null,
    );
    const nextCollapsed: Record<string, true> = {};
    for (const existing of rootSections) {
      if (existing.id !== section.id) {
        nextCollapsed[existing.id] = true;
      }
    }
    setCollapsedSectionIds(nextCollapsed);
  }

  async function onAddImageElements(items: AddImageItem[]) {
    if (items.length === 0) {
      return;
    }

    setImageSubmitting(true);
    try {
      const uploads = await mapWithConcurrency(items, 3, async (item) => {
        const { path, meta } = await uploadImage(userId, item.file);
        return {
          image_path: path,
          caption: item.caption,
          taken_at: meta.taken_at,
          latitude: meta.latitude,
          longitude: meta.longitude,
        };
      });

      editor.addImageElementsAt(insertFlatIndex, uploads);
      setAddImageOpen(false);
    } finally {
      setImageSubmitting(false);
    }
  }

  async function onPublish() {
    await editor.saveNow();
    await publishDraft.mutateAsync(page.id);
    setIsEditing(false);
  }

  async function onDiscard() {
    const confirmed = window.confirm(
      "Discard your draft? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    if (draftQuery.data) {
      await discardDraft.mutateAsync(page.id);
    }
    editor.resetToLive();
    setIsEditing(false);
  }

  function onEnterEdit() {
    setIsEditing(true);
  }

  return (
    <>
      <PageTopBar
        isEditing={isEditing}
        onEnterEdit={onEnterEdit}
        onDiscard={() => void onDiscard()}
        onPublish={() => void onPublish()}
        publishing={publishDraft.isPending}
        discarding={discardDraft.isPending}
      />

      <header className="mt-8">
        <h1 className="text-4xl tracking-tight">{page.name}</h1>
        <p className="text-muted text-base">/{page.tag}</p>
      </header>

      <div className="mt-10">
        <MainImageBlock
          path={displayMainImagePath}
          editable={isEditing}
          uploading={mainUploading}
          onPick={(file) => void onMainImagePick(file)}
        />
      </div>

      <section className="mt-10">
        <PageElementsList
          elements={displayElements}
          editable={isEditing}
          collapsedSectionIds={collapsedSectionIds}
          onToggleSectionCollapsed={toggleSectionCollapsed}
          onUpdateElementText={isEditing ? editor.updateElementText : undefined}
          onUpdateMapPlaces={isEditing ? editor.updateMapPlaces : undefined}
          onDeleteElement={isEditing ? editor.deleteElementById : undefined}
          onReorderToFlatIds={isEditing ? editor.reorderToFlatIds : undefined}
          onInsertAtFlatIndex={isEditing ? openAddMenuAtFlatIndex : undefined}
        />
      </section>

      <AddElementDialog
        open={chooseElementOpen}
        onClose={() => setChooseElementOpen(false)}
        onChooseImage={() => {
          setChooseElementOpen(false);
          setAddImageOpen(true);
        }}
        onChooseText={() => {
          onAddTextElement();
          setChooseElementOpen(false);
        }}
        onChooseSection={() => {
          onAddSectionElement();
          setChooseElementOpen(false);
        }}
        onChooseMap={() => {
          onAddMapElement();
          setChooseElementOpen(false);
        }}
      />

      <AddImageDialog
        open={addImageOpen}
        onClose={() => setAddImageOpen(false)}
        submitting={imageSubmitting}
        onSubmit={(payload) => void onAddImageElements(payload)}
      />
    </>
  );
}

export function PageView() {
  const { tag = "" } = useParams<{ tag: string }>();
  const { user, accessToken } = useAuth();

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

  const liveElements = elementsQuery.data ?? [];

  return (
    <Container className="min-h-screen">
      {pageQuery.isLoading ? (
        <p className="text-muted mt-10 text-sm">Loading</p>
      ) : pageQuery.error ? (
        <p className="mt-10 text-sm text-red-600">Could not load page</p>
      ) : !page ? (
        <>
          <BackLink to="/" />
          <div className="mt-10 space-y-2">
            <h1 className="text-3xl">Not found</h1>
            <p className="text-muted text-sm">
              This page does not exist or you do not have access.
            </p>
          </div>
        </>
      ) : !accessToken || !user ? (
        <p className="text-muted mt-10 text-sm">Loading</p>
      ) : (
        <LoadedPageView
          page={page}
          liveElements={liveElements}
          accessToken={accessToken}
          userId={user.id}
        />
      )}
    </Container>
  );
}
