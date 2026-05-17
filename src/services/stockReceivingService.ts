import { supabase } from "@/lib/supabase";
import type {
  StockReceiving,
  StockReceivingItem,
  Product,
  ProductUnit,
  Supplier,
  Profile,
  PurchaseOrder,
} from "@/types/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Join types ─────────────────────────────────────────────
export interface StockReceivingWithDetails extends StockReceiving {
  suppliers: Pick<Supplier, "id" | "name"> | null;
  purchase_orders: Pick<PurchaseOrder, "id" | "po_number"> | null;
  received_by_profile: Pick<Profile, "id" | "full_name"> | null;
}

export interface ReceivingItemWithDetails extends StockReceivingItem {
  products: Pick<Product, "id" | "name" | "generic_name"> | null;
  product_units: Pick<ProductUnit, "id" | "unit_name"> | null;
}

export interface StockReceivingFull extends StockReceivingWithDetails {
  stock_receiving_items: ReceivingItemWithDetails[];
}

export interface CompleteReceivingPayload {
  branch_id: string;
  supplier_id: string | null;
  purchase_order_id: string | null;
  notes: string | null;
  items: Array<{
    product_id: string;
    product_unit_id: string;
    purchase_order_item_id: string | null;
    batch_number: string;
    stock_in_date: string;
    expiry_date: string | null;
    quantity_received: number;
    cost_price_per_unit: number;
  }>;
}

// ─── Select constants ───────────────────────────────────────
const LIST_SELECT = `
  *,
  suppliers(id, name),
  purchase_orders(id, po_number),
  received_by_profile:profiles!received_by(id, full_name)
` as const;

const DETAIL_SELECT = `
  *,
  suppliers(id, name),
  purchase_orders(id, po_number),
  received_by_profile:profiles!received_by(id, full_name),
  stock_receiving_items(
    *,
    products(id, name, generic_name),
    product_units(id, unit_name)
  )
` as const;

// ─── Service ────────────────────────────────────────────────
export const stockReceivingService = {
  async getAll(branchId: string | null): Promise<StockReceivingWithDetails[]> {
    let query = db
      .from("stock_receivings")
      .select(LIST_SELECT)
      .order("received_at", { ascending: false })
      .limit(200);

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) throw error;
    return data as StockReceivingWithDetails[];
  },

  async getById(id: string): Promise<StockReceivingFull> {
    const { data, error } = await db
      .from("stock_receivings")
      .select(DETAIL_SELECT)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as unknown as StockReceivingFull;
  },

  async complete(
    payload: CompleteReceivingPayload,
  ): Promise<{ success: boolean; receiving_id: string }> {
    const { data, error } = await db.rpc("complete_stock_receiving", {
      p_data: payload,
    });
    if (error) throw error;
    const result = data as {
      success: boolean;
      receiving_id: string;
      error?: string;
    };
    if (!result.success)
      throw new Error(result.error ?? "Failed to complete receiving");
    return result;
  },
};
