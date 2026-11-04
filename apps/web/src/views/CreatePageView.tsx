import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCreatePage } from "../api/pages.js";
import { BackLink } from "../components/BackLink.js";
import { Button } from "../components/Button.js";
import { Container } from "../components/Container.js";
import { TextField } from "../components/TextField.js";
import { useAuth } from "../lib/auth/AuthProvider.js";
import { sanitizeTagInput, suggestTagFromName } from "../lib/tags.js";

export function CreatePageView() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const createPage = useCreatePage(accessToken);

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [tagEdited, setTagEdited] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    if (!tagEdited) {
      setTag(suggestTagFromName(value));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedTag = sanitizeTagInput(tag);
    if (!trimmedName || trimmedTag.length < 2) {
      return;
    }

    try {
      const page = await createPage.mutateAsync({
        name: trimmedName,
        tag: trimmedTag,
      });
      navigate(`/${page.tag}`, { replace: true });
    } catch {
      // error shown below
    }
  }

  const tagError =
    createPage.error?.message === "Tag is already taken"
      ? "Tag is already taken"
      : createPage.error?.message;

  return (
    <Container className="flex min-h-screen flex-col pb-8">
      <div className="mb-8">
        <BackLink to="/" />
      </div>

      <h1 className="mb-10 text-center text-3xl tracking-tight">Create page</h1>

      <form className="flex flex-1 flex-col gap-8" onSubmit={onSubmit}>
        <TextField
          label="Name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
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
          {tagError ? <p className="text-sm text-red-600">{tagError}</p> : null}
        </label>

        <div className="mt-auto pt-8">
          <Button
            type="submit"
            variant="primary"
            width="full"
            disabled={createPage.isPending}
          >
            {createPage.isPending ? "Creating" : "Create"}
          </Button>
        </div>
      </form>
    </Container>
  );
}
