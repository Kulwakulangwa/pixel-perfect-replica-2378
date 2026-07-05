export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          lipa_namba_provider:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          note: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          recorded_by: string
          sale_id: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          lipa_namba_provider?:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          note?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          recorded_by: string
          sale_id?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          lipa_namba_provider?:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          note?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          recorded_by?: string
          sale_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string | null
          expense_date: string
          id: string
          recorded_by: string
          shop_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by: string
          shop_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          recorded_by?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          buying_price: number
          created_at: string
          current_stock: number
          id: string
          image_url: string | null
          is_active: boolean
          minimum_stock: number
          name: string
          selling_price: number
          shop_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          buying_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          minimum_stock?: number
          name: string
          selling_price: number
          shop_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          buying_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          minimum_stock?: number
          name?: string
          selling_price?: number
          shop_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          unit_cost?: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string
          client_ref: string | null
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          lipa_namba_provider:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          receipt_number: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          shop_id: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          synced: boolean
          till_session_id: string | null
          total: number
        }
        Insert: {
          cashier_id: string
          client_ref?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          lipa_namba_provider?:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_number: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          shop_id: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          synced?: boolean
          till_session_id?: string | null
          total: number
        }
        Update: {
          cashier_id?: string
          client_ref?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          lipa_namba_provider?:
            | Database["public"]["Enums"]["lipa_namba_provider"]
            | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_number?: string
          sale_type?: Database["public"]["Enums"]["sale_type"]
          shop_id?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          synced?: boolean
          till_session_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          currency: string
          id: string
          logo_url: string | null
          low_stock_default: number
          name: string
          receipt_footer: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          low_stock_default?: number
          name: string
          receipt_footer?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          low_stock_default?: number
          name?: string
          receipt_footer?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          can_discount: boolean
          can_manage_till: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          shop_id: string
        }
        Insert: {
          can_discount?: boolean
          can_manage_till?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id: string
        }
        Update: {
          can_discount?: boolean
          can_manage_till?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          quantity_change: number
          shop_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity_change: number
          shop_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity_change?: number
          shop_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      till_sessions: {
        Row: {
          cashier_id: string
          closed_at: string | null
          closing_count: number | null
          expected_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opening_float: number
          shop_id: string
          status: Database["public"]["Enums"]["till_status"]
          variance: number | null
        }
        Insert: {
          cashier_id: string
          closed_at?: string | null
          closing_count?: number | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_float?: number
          shop_id: string
          status?: Database["public"]["Enums"]["till_status"]
          variance?: number | null
        }
        Update: {
          cashier_id?: string
          closed_at?: string | null
          closing_count?: number | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opening_float?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["till_status"]
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "till_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_best_sellers: {
        Row: {
          product_id: string | null
          product_name: string | null
          revenue: number | null
          shop_id: string | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      v_customer_balances: {
        Row: {
          balance: number | null
          customer_id: string | null
          last_purchase_at: string | null
          name: string | null
          phone: string | null
          shop_id: string | null
        }
        Insert: {
          balance?: never
          customer_id?: string | null
          last_purchase_at?: never
          name?: string | null
          phone?: string | null
          shop_id?: string | null
        }
        Update: {
          balance?: never
          customer_id?: string | null
          last_purchase_at?: never
          name?: string | null
          phone?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      v_low_stock: {
        Row: {
          current_stock: number | null
          id: string | null
          image_url: string | null
          minimum_stock: number | null
          name: string | null
          shop_id: string | null
        }
        Insert: {
          current_stock?: number | null
          id?: string | null
          image_url?: string | null
          minimum_stock?: number | null
          name?: string | null
          shop_id?: string | null
        }
        Update: {
          current_stock?: number | null
          id?: string | null
          image_url?: string | null
          minimum_stock?: number | null
          name?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cashier_today_summary: {
        Args: never
        Returns: {
          revenue: number
          sales_count: number
        }[]
      }
      current_shop_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      pos_products: {
        Args: never
        Returns: {
          current_stock: number
          id: string
          image_url: string
          minimum_stock: number
          name: string
          selling_price: number
          sku: string
        }[]
      }
      report_sales_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          cost: number
          day: string
          discount_total: number
          profit: number
          revenue: number
          sales_count: number
        }[]
      }
    }
    Enums: {
      expense_category:
        | "rent"
        | "electricity"
        | "transport"
        | "salaries"
        | "stock_purchase"
        | "other"
      lipa_namba_provider: "mpesa" | "airtel_money" | "tigo_pesa"
      payment_method: "cash" | "lipa_namba"
      sale_status: "completed" | "voided"
      sale_type: "cash" | "credit"
      stock_movement_type:
        | "restock"
        | "adjustment"
        | "sale_deduction"
        | "void_restore"
      till_status: "open" | "closed"
      user_role: "owner" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      expense_category: [
        "rent",
        "electricity",
        "transport",
        "salaries",
        "stock_purchase",
        "other",
      ],
      lipa_namba_provider: ["mpesa", "airtel_money", "tigo_pesa"],
      payment_method: ["cash", "lipa_namba"],
      sale_status: ["completed", "voided"],
      sale_type: ["cash", "credit"],
      stock_movement_type: [
        "restock",
        "adjustment",
        "sale_deduction",
        "void_restore",
      ],
      till_status: ["open", "closed"],
      user_role: ["owner", "cashier"],
    },
  },
} as const
