import { supabase } from "@/lib/supabase";
import type {
  StockBatch,
  StockAdjustment,
  Product,
  ProductUnit,
  Supplier,
  Profile,
  AdjustmentType,
} from "@/types/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Join types ─────────────────────────────────────────────
export interface StockBatchWithDetails extends StockBatch {
  products: Pick<Product, "id" | "name" | "generic_name"> | null;
  product_units: Pick<ProductUnit, "id" | "unit_name"> | null;
  suppliers: Pick<Supplier, "id" | "name"> | null;
}

export interface StockAdjustmentWithDetails extends StockAdjustment {
  products: Pick<Product, "id" | "name"> | null;
  stock_batches: Pick<StockBatch, "id" | "batch_number" | "expiry_date"> | null;
  adjusted_by_profile: Pick<Profile, "id" | "full_name"> | null;
}

export interface InventoryStats {
  totalBatches: number;
  totalStockValue: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  outOfStockCount: number;
  pendingPOCount: number;
  recentAdjustmentCount: number;
}

// ─── Filters ────────────────────────────────────────────────
export interface BatchFilters {
  search?: string;
  expiryStatus?: "all" | "expiring_soon" | "expired" | "valid";
  supplierId?: string;
  showDepleted?: boolean;
}

export interface AdjustmentFilters {
  search?: string;
  adjustmentType?: AdjustmentType;
  dateFrom?: string;
  dateTo?: string;
}

export interface ProductStockFilters {
  search?: string;
  categoryId?: string;
  supplierId?: string;
  showOutOfStock?: boolean;
  lowStockThreshold?: number;
}

// ─── Product Stock Aggregate Type ──────────────────────────
export interface ProductStockAggregate {
  product_id: string;
  product_name: string;
  generic_name: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  unit_name: string;
  quantity_remaining: number;
  is_active: boolean;
}

// ─── Select constants ───────────────────────────────────────
const BATCH_SELECT = `
  *,
  products(id, name, generic_name),
  product_units(id, unit_name),
  suppliers(id, name)
` as const;

const ADJUSTMENT_SELECT = `
  *,
  products(id, name),
  stock_batches(id, batch_number, expiry_date),
  adjusted_by_profile:profiles!adjusted_by(id, full_name)
` as const;

// ─── Service ────────────────────────────────────────────────
export const inventoryService = {
  // ─── Stock Batches ─────────────────────────────────────────
  async getBatches(
    branchId: string | null,
    filters: BatchFilters = {},
  ): Promise<StockBatchWithDetails[]> {
    let query = db
      .from("stock_batches")
      .select(BATCH_SELECT)
      .order("created_at", { ascending: false });

    if (branchId) query = query.eq("branch_id", branchId);
    if (!filters.showDepleted) query = query.gt("quantity_remaining", 0);
    if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);

    const { data, error } = await query;
    if (error) throw error;

    let result = data as StockBatchWithDetails[];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.batch_number.toLowerCase().includes(q) ||
          (b.products?.name ?? "").toLowerCase().includes(q) ||
          (b.products?.generic_name ?? "").toLowerCase().includes(q),
      );
    }

    if (filters.expiryStatus && filters.expiryStatus !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDays = new Date(today.getTime() + 30 * 86400000);

      result = result.filter((b) => {
        if (!b.expiry_date) return filters.expiryStatus === "valid";
        const exp = new Date(b.expiry_date);
        if (filters.expiryStatus === "expired") return exp < today;
        if (filters.expiryStatus === "expiring_soon")
          return exp >= today && exp <= thirtyDays;
        if (filters.expiryStatus === "valid") return exp > thirtyDays;
        return true;
      });
    }

    return result;
  },

  async getBatchById(id: string): Promise<StockBatchWithDetails> {
    const { data, error } = await db
      .from("stock_batches")
      .select(BATCH_SELECT)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as StockBatchWithDetails;
  },

  async updateBatch(
    id: string,
    updates: Partial<
      Pick<StockBatch, "batch_number" | "expiry_date" | "cost_price_per_unit">
    >,
  ): Promise<StockBatchWithDetails> {
    const { error } = await db
      .from("stock_batches")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return inventoryService.getBatchById(id);
  },

  async getBatchesByProduct(
    productId: string,
    branchId: string | null,
  ): Promise<StockBatchWithDetails[]> {
    let query = db
      .from("stock_batches")
      .select(BATCH_SELECT)
      .eq("product_id", productId)
      .gt("quantity_remaining", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false });

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) throw error;
    return data as StockBatchWithDetails[];
  },

  // ─── Product Stock Aggregates ──────────────────────────────
  async getProductsWithAggregatedStock(
    branchId: string | null,
    filters: ProductStockFilters = {},
  ): Promise<ProductStockAggregate[]> {
    // Fetch all active products with their details
    let productsQuery = db
      .from("products")
      .select(
        `
        id, name, generic_name, is_active, category_id,
        categories(id, name),
        suppliers(id, name)
      `,
      )
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (filters.categoryId)
      productsQuery = productsQuery.eq("category_id", filters.categoryId);
    if (filters.supplierId)
      productsQuery = productsQuery.eq("supplier_id", filters.supplierId);

    const { data: products, error: productsError } = await productsQuery;
    if (productsError) throw productsError;

    // Fetch all stock batches with stock for the branch
    let batchesQuery = db.from("stock_batches").select(`
        product_id, quantity_remaining, product_units(unit_name)
      `);

    if (branchId) batchesQuery = batchesQuery.eq("branch_id", branchId);

    const { data: batches, error: batchesError } = await batchesQuery;
    if (batchesError) throw batchesError;

    // Aggregate stock quantities by product
    const stockMap = new Map<string, { quantity: number; unitName: string }>();
    const batchesTyped = batches as Array<{
      product_id: string;
      quantity_remaining: number;
      product_units: { unit_name: string } | null;
    }>;

    for (const batch of batchesTyped) {
      const existing = stockMap.get(batch.product_id);
      const unitName = batch.product_units?.unit_name ?? "Unit";
      if (existing) {
        stockMap.set(batch.product_id, {
          quantity: existing.quantity + batch.quantity_remaining,
          unitName,
        });
      } else {
        stockMap.set(batch.product_id, {
          quantity: batch.quantity_remaining,
          unitName,
        });
      }
    }

    // Combine products with aggregated stock
    type ProductRow = {
      id: string;
      name: string;
      generic_name: string | null;
      is_active: boolean;
      category_id: string | null;
      categories: { id: string; name: string } | null;
      suppliers: { id: string; name: string } | null;
    };

    let result: ProductStockAggregate[] = (products as ProductRow[]).map(
      (p) => {
        const stock = stockMap.get(p.id);
        return {
          product_id: p.id,
          product_name: p.name,
          generic_name: p.generic_name,
          category_id: p.category_id,
          category_name: p.categories?.name ?? null,
          supplier_id: p.suppliers?.id ?? null,
          supplier_name: p.suppliers?.name ?? null,
          unit_name: stock?.unitName ?? "Unit",
          quantity_remaining: stock?.quantity ?? 0,
          is_active: p.is_active,
        };
      },
    );

    // Apply client-side filters
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          (p.generic_name ?? "").toLowerCase().includes(q),
      );
    }

    if (filters.showOutOfStock === false) {
      result = result.filter((p) => p.quantity_remaining > 0);
    }

    if (
      filters.lowStockThreshold !== undefined &&
      filters.lowStockThreshold > 0
    ) {
      result = result.filter(
        (p) => p.quantity_remaining <= filters.lowStockThreshold!,
      );
    }

    return result;
  },

  // ─── Stock Adjustments ─────────────────────────────────────
  async getAdjustments(
    branchId: string | null,
    filters: AdjustmentFilters = {},
  ): Promise<StockAdjustmentWithDetails[]> {
    let query = db
      .from("stock_adjustments")
      .select(ADJUSTMENT_SELECT)
      .order("created_at", { ascending: false })
      .limit(500);

    if (branchId) query = query.eq("branch_id", branchId);
    if (filters.adjustmentType)
      query = query.eq("adjustment_type", filters.adjustmentType);
    if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
    if (filters.dateTo)
      query = query.lte("created_at", filters.dateTo + "T23:59:59");

    const { data, error } = await query;
    if (error) throw error;

    let result = data as StockAdjustmentWithDetails[];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (a) =>
          (a.products?.name ?? "").toLowerCase().includes(q) ||
          (a.stock_batches?.batch_number ?? "").toLowerCase().includes(q) ||
          (a.reason ?? "").toLowerCase().includes(q),
      );
    }

    return result;
  },

  async applyAdjustment(payload: {
    branch_id: string;
    product_id: string;
    batch_id: string;
    adjustment_type: AdjustmentType;
    quantity: number;
    reason: string;
  }): Promise<{
    success: boolean;
    adjustment_id: string;
    new_quantity: number;
  }> {
    const { data, error } = await db.rpc("apply_stock_adjustment", {
      p_data: payload,
    });
    if (error) throw error;
    const result = data as {
      success: boolean;
      adjustment_id: string;
      new_quantity: number;
      error?: string;
    };
    if (!result.success)
      throw new Error(result.error ?? "Failed to apply adjustment");
    return result;
  },

  // ─── Inventory Stats ──────────────────────────────────────
  async getStats(branchId: string | null): Promise<InventoryStats> {
    let batchesQuery = db
      .from("stock_batches")
      .select(
        "quantity_remaining, cost_price_per_unit, expiry_date, product_id",
      )
      .gt("quantity_remaining", 0);
    if (branchId) batchesQuery = batchesQuery.eq("branch_id", branchId);

    let poQuery = db
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent", "partially_received"]);
    if (branchId) poQuery = poQuery.eq("branch_id", branchId);

    let adjQuery = db
      .from("stock_adjustments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    if (branchId) adjQuery = adjQuery.eq("branch_id", branchId);

    let productsQuery = db
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_active", true);

    const [batchesRes, poRes, adjRes, productsRes] = await Promise.all([
      batchesQuery,
      poQuery,
      adjQuery,
      productsQuery,
    ]);

    if (batchesRes.error) throw batchesRes.error;
    if (poRes.error) throw poRes.error;
    if (adjRes.error) throw adjRes.error;
    if (productsRes.error) throw productsRes.error;

    type BatchRow = {
      quantity_remaining: number;
      cost_price_per_unit: number;
      expiry_date: string | null;
      product_id: string;
    };
    const batches = batchesRes.data as BatchRow[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDays = new Date(today.getTime() + 30 * 86400000);

    let totalStockValue = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    const productQtys = new Map<string, number>();

    for (const b of batches) {
      totalStockValue += b.quantity_remaining * b.cost_price_per_unit;

      if (b.expiry_date) {
        const exp = new Date(b.expiry_date);
        if (exp < today) expiredCount++;
        else if (exp <= thirtyDays) expiringCount++;
      }

      productQtys.set(
        b.product_id,
        (productQtys.get(b.product_id) ?? 0) + b.quantity_remaining,
      );
    }

    const lowStockCount = Array.from(productQtys.values()).filter(
      (qty) => qty > 0 && qty <= 10,
    ).length;
    const totalProducts = productsRes.count ?? 0;
    const outOfStockCount = Math.max(0, totalProducts - productQtys.size);

    return {
      totalBatches: batches.length,
      totalStockValue,
      lowStockCount,
      expiringCount,
      expiredCount,
      outOfStockCount,
      pendingPOCount: poRes.count ?? 0,
      recentAdjustmentCount: adjRes.count ?? 0,
    };
  },
};
