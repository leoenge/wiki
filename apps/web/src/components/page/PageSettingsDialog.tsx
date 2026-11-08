import { CaretRightIcon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { tagSchema, type Page } from "@ww/types";

import { useUpdatePage } from "../../api/pages.js";
import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { TextField } from "../TextField.js";
import { ViewSwitcher } from "../ViewSwitcher.js";
import { sanitizeTagInput } from "../../lib/tags.js";
import { PageShareSettings } from "./PageShareSettings.js";

type SettingsView = "main" | "share";

type PageSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  page: Page;
  accessToken: string;
};

export function PageSettingsDialog({
  open,
  onClose,
  page,
  accessToken,
}: PageSettingsDialogProps) {
  const navigate = useNavigate();
  const updatePage = useUpdatePage(accessToken);

  const [view, setView] = useState<SettingsView>("main");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [name, setName] = useState(page.name);
  const [tag, setTag] = useState(page.tag);
  const [tagEdited, setTagEdited] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setView("main");
    setDirection("forward");
    setName(page.name);
    setTag(page.tag);
    setTagEdited(false);
    updatePage.reset();
  }, [open, page.id, page.name, page.tag, updatePage]);

  const trimmedName = name.trim();
  const trimmedTag = sanitizeTagInput(tag);
  const nameChanged = trimmedName !== page.name;
  const tagChanged = trimmedTag !== page.tag;

  const tagParse = useMemo(
    () => tagSchema.safeParse(trimmedTag),
    [trimmedTag],
  );

  const tagError = useMemo(() => {
    if (updatePage.error?.message === "Tag is already taken") {
      return "Tag is already taken";
    }
    if (tagChanged && !tagParse.success) {
      const issue = tagParse.error.issues[0];
      return issue?.message === "Tag is reserved"
        ? "Tag is reserved"
        : "Invalid tag format";
    }
    return null;
  }, [tagChanged, tagParse, updatePage.error?.message]);

  const saveDisabled =
    updatePage.isPending ||
    (!nameChanged && !tagChanged) ||
    trimmedName.length < 1 ||
    trimmedName.length > 100 ||
    (tagChanged && !tagParse.success);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }

    const body: { name?: string; tag?: string } = {};
    if (nameChanged) {
      body.name = trimmedName;
    }
    if (tagChanged) {
      body.tag = trimmedTag;
    }

    try {
      const updated = await updatePage.mutateAsync({
        pageId: page.id,
        body,
        previousTag: page.tag,
      });
      onClose();
      if (tagChanged) {
        navigate(`/${updated.tag}`, { replace: true });
      }
    } catch {
      // shown via tagError / mutation error
    }
  }

  function openShare() {
    setDirection("forward");
    setView("share");
  }

  function backToMain() {
    setDirection("back");
    setView("main");
  }

  const dialogTitle = view === "share" ? "Share" : "Settings";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dialogTitle}
      onBack={view === "share" ? backToMain : undefined}
    >
      <ViewSwitcher
        activeView={view}
        direction={direction}
        views={{
          main: (
            <form className="space-y-6" onSubmit={onSave}>
              <TextField
                label="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />

              <label className="block space-y-2">
                <span className="text-sm font-medium">Tag</span>
                <div className="bg-surface flex items-center rounded-xs px-4 py-3">
                  <span className="text-muted text-base">/</span>
                  <input
                    value={tag}
                    onChange={(event) => {
                      setTagEdited(true);
                      setTag(sanitizeTagInput(event.target.value));
                    }}
                    className="text-foreground w-full bg-transparent text-base outline-none"
                    maxLength={30}
                    required
                  />
                </div>
                {tagError ? (
                  <p className="text-sm text-red-600">{tagError}</p>
                ) : null}
                {tagEdited && tagChanged ? (
                  <p className="text-muted text-sm leading-relaxed">
                    Links that used the previous tag will stop working when you
                    save.
                  </p>
                ) : null}
              </label>

              <Button
                type="submit"
                variant="primary"
                width="full"
                disabled={saveDisabled}
              >
                {updatePage.isPending ? "Saving" : "Save"}
              </Button>

              <button
                type="button"
                onClick={openShare}
                className="hover:text-foreground text-muted flex w-full items-center justify-between py-1 text-sm font-medium"
              >
                Share
                <CaretRightIcon size={16} weight="bold" />
              </button>
            </form>
          ),
          share: (
            <PageShareSettings page={page} accessToken={accessToken} />
          ),
        }}
      />
    </Dialog>
  );
}
