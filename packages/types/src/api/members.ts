import { z } from "zod";

export const addPageMemberBodySchema = z.object({
  email: z.string().trim().email(),
});

export type AddPageMemberBody = z.infer<typeof addPageMemberBodySchema>;

export type PageMemberAdded = {
  user_id: string;
  first_name: string;
  created_at: string;
};

export type InvitePreview = {
  page_name: string;
};
