
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "data_migrations": {
                  Row: {
                    "applied_at": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string,"id": string
                  }
                  Update: {
                    "applied_at"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"element_comments": {
                  Row: {
                    "body": string,"created_at": string,"element_id": string,"id": string,"page_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"element_id": string,"id"?: string,"page_id": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"element_id"?: string,"id"?: string,"page_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "element_comments_element_page_fkey"
      columns: ["element_id","page_id"]
isOneToOne: false
      referencedRelation: "page_elements"
      referencedColumns: ["id","page_id"]
    },{
      foreignKeyName: "element_comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"images": {
                  Row: {
                    "created_at": string,"id": string,"latitude": number | null,"longitude": number | null,"owner_id": string,"path": string,"taken_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"owner_id": string,"path": string,"taken_at": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"owner_id"?: string,"path"?: string,"taken_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"page_drafts": {
                  Row: {
                    "base_version": number,"content": NonNullable<Json>,"created_at": string,"id": string,"page_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_version"?: number,"content": NonNullable<Json>,"created_at"?: string,"id"?: string,"page_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "base_version"?: number,"content"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"page_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_drafts_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    }
                  ]
                },"page_element_items": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"element_id": string,"id": string,"label": string,"page_id": string,"position": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"element_id": string,"id"?: string,"label": string,"page_id": string,"position": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"element_id"?: string,"id"?: string,"label"?: string,"page_id"?: string,"position"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_element_items_element_page_fkey"
      columns: ["element_id","page_id"]
isOneToOne: false
      referencedRelation: "page_elements"
      referencedColumns: ["id","page_id"]
    }
                  ]
                },"page_elements": {
                  Row: {
                    "caption": string | null,"created_at": string,"id": string,"image_id": string | null,"image_path": string | null,"list_style": string | null,"page_id": string,"parent_id": string | null,"position": number,"text": string | null,"type": Database["public"]['Enums']["page_element_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"image_id"?: string | null,"image_path"?: string | null,"list_style"?: string | null,"page_id": string,"parent_id"?: string | null,"position": number,"text"?: string | null,"type": Database["public"]['Enums']["page_element_type"],"updated_at"?: string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"id"?: string,"image_id"?: string | null,"image_path"?: string | null,"list_style"?: string | null,"page_id"?: string,"parent_id"?: string | null,"position"?: number,"text"?: string | null,"type"?: Database["public"]['Enums']["page_element_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_elements_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "images"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_elements_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_elements_parent_fkey"
      columns: ["parent_id","page_id"]
isOneToOne: false
      referencedRelation: "page_elements"
      referencedColumns: ["id","page_id"]
    }
                  ]
                },"page_members": {
                  Row: {
                    "added_by": string | null,"created_at": string,"page_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"page_id": string,"user_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"page_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_members_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_members_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "page_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pages": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"invite_token": string,"last_published_at": string | null,"last_published_by": string | null,"main_image_id": string | null,"main_image_path": string | null,"name": string,"tag": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"invite_token": string,"last_published_at"?: string | null,"last_published_by"?: string | null,"main_image_id"?: string | null,"main_image_path"?: string | null,"name": string,"tag": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"invite_token"?: string,"last_published_at"?: string | null,"last_published_by"?: string | null,"main_image_id"?: string | null,"main_image_path"?: string | null,"name"?: string,"tag"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_last_published_by_fkey"
      columns: ["last_published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pages_main_image_id_fkey"
      columns: ["main_image_id"]
isOneToOne: false
      referencedRelation: "images"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"first_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"first_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"first_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "comment": string | null,"created_at": string,"id": string,"item_id": string,"page_id": string,"rating": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"item_id": string,"page_id": string,"rating"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"id"?: string,"item_id"?: string,"page_id"?: string,"rating"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_item_page_fkey"
      columns: ["item_id","page_id"]
isOneToOne: false
      referencedRelation: "page_element_items"
      referencedColumns: ["id","page_id"]
    },{
      foreignKeyName: "reviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "element_comment_counts": {
                  Row: {
                    "count": number | null,"element_id": string,"page_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "element_comments_element_page_fkey"
      columns: ["element_id","page_id"]
isOneToOne: false
      referencedRelation: "page_elements"
      referencedColumns: ["id","page_id"]
    }
                  ]
                }
          }
          Functions: {
            "can_read_image_path":
{ Args: { "p_path": string }; Returns: boolean
                           },
"find_user_id_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"is_page_member":
{ Args: { "p_page_id": string }; Returns: boolean
                           },
"publish_page_draft":
{ Args: { "p_content": Json,"p_force"?: boolean,"p_page_id": string,"p_user_id": string }; Returns: Json
                           },
"remove_page_member":
{ Args: { "p_page_id": string,"p_user_id": string }; Returns: undefined
                           },
"shares_page_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "page_element_type": "image"|"text"|"section"|"map"|"list"|"review"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "page_element_type": ["image", "text", "section", "map", "list", "review"]
          }
        }
} as const
