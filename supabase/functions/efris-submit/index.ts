// INFRA MEDIK POS — EFRIS e-Invoice submission (T109)
// Deploy via Supabase dashboard → Edge Functions → efris-submit
//
// Required secrets (set via dashboard → Settings → Edge Functions):
//   EFRIS_API_URL        e.g. https://efristest.ura.go.ug/efrisws/ws/taMapping
//   EFRIS_DEVICE_NO      Device serial number from URA registration
//   EFRIS_DEVICE_SECRET  32-byte AES / HMAC secret from URA
//   EFRIS_TIN            Taxpayer TIN — 10756690689
//   SUPABASE_URL         Injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY  Injected automatically by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────

const EFRIS_API_URL =
  Deno.env.get("EFRIS_API_URL") ??
  "https://efristest.ura.go.ug/efrisws/ws/taMapping";
const DEVICE_NO = Deno.env.get("EFRIS_DEVICE_NO") ?? "PLACEHOLDER_DEVICE_NO";
const DEVICE_SECRET =
  Deno.env.get("EFRIS_DEVICE_SECRET") ?? "PLACEHOLDER_SECRET_32BYTES_FILL";
const TIN = Deno.env.get("EFRIS_TIN") ?? "10756690689";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Crypto helpers ───────────────────────────────────────────

/**
 * AES-256-ECB encrypt (PKCS7 padded) and base64-encode.
 * Web Crypto API only exposes CBC; we simulate ECB by encrypting
 * each 16-byte block independently with CBC + zero IV.
 * AES-CBC(block, IV=0) == AES-ECB(block) for a single block.
 */
async function aes256EcbEncryptB64(
  secret: string,
  plaintext: string,
): Promise<string> {
  // Derive a 32-byte key: SHA-256 of the secret string
  const rawKey = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    "AES-CBC",
    false,
    ["encrypt"],
  );
  const zeroIV = new Uint8Array(16);

  const data = new TextEncoder().encode(plaintext);
  const padLen = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  padded.fill(padLen, data.length); // PKCS7

  const result = new Uint8Array(padded.length);
  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16);
    // CBC of one block with zero IV → first 16 bytes = ECB of that block
    const enc = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-CBC", iv: zeroIV },
        cryptoKey,
        block,
      ),
    );
    result.set(enc.slice(0, 16), i);
  }

  return btoa(String.fromCharCode(...result));
}

/** HMAC-SHA256, base64-encoded. Used to sign the encrypted content. */
async function hmacSha256B64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function randomDataExchangeId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 19);
}

function efrisTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function efrisDateDisplay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── T109 Invoice builder ─────────────────────────────────────

interface SaleRow {
  id: string;
  sale_number: string;
  total_amount: number;
  vat_amount: number;
  subtotal_before_vat: number;
  created_at: string;
  teller_name: string | null;
  customer_name: string | null;
  customer_tin: string | null;
  customer_phone: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_before_vat: number;
    vat_per_unit: number;
    line_total_before_vat: number;
    line_vat: number;
    line_total: number;
    is_vat_exempt: boolean;
  }>;
  payments: Array<{
    payment_method: string;
    amount: number;
  }>;
}

const PAYMENT_MODE: Record<string, string> = {
  cash: "101",
  mtn_momo: "106",
  airtel_money: "106",
};

function buildT109Content(sale: SaleRow): object {
  const issuedAt = new Date(sale.created_at);

  const goods = sale.items.map((it, idx) => {
    const taxRate = it.is_vat_exempt ? "0%" : "18%";
    const taxRateCode = it.is_vat_exempt ? "01" : "02";
    return {
      item: String(idx + 1),
      itemCode: it.product_id.slice(0, 20),
      itemName: it.product_name.slice(0, 100),
      quantity: it.quantity.toFixed(2),
      unitOfMeasure: "PCE",
      unitPrice: it.unit_price_before_vat.toFixed(2),
      total: it.line_total_before_vat.toFixed(2),
      taxRate,
      tax: it.line_vat.toFixed(2),
      discountTotal: "0.00",
      discountTaxRate: "0%",
      orderNumber: "",
      discountFlag: "2",
      deemedFlag: "2",
      exciseFlag: "2",
      categoryId: "",
      categoryName: "",
      goodsCategoryId: "6",
      goodsCategoryName: "Pharmaceuticals",
      exciseRate: "0%",
      exciseTax: "0.00",
      pack: "",
      stockFlag: "2",
      serviceType: "",
      isExempt: it.is_vat_exempt ? "1" : "0",
      isExport: "0",
      taxRateCode,
    };
  });

  // Aggregate VAT by rate (standard 18% and exempt 0%)
  const standardVat = sale.items
    .filter((i) => !i.is_vat_exempt)
    .reduce((s, i) => s + i.line_vat, 0);
  const standardNet = sale.items
    .filter((i) => !i.is_vat_exempt)
    .reduce((s, i) => s + i.line_total_before_vat, 0);
  const standardGross = sale.items
    .filter((i) => !i.is_vat_exempt)
    .reduce((s, i) => s + i.line_total, 0);
  const exemptNet = sale.items
    .filter((i) => i.is_vat_exempt)
    .reduce((s, i) => s + i.line_total, 0);

  const taxDetails = [];
  if (standardGross > 0) {
    taxDetails.push({
      taxCategory: "VAT",
      taxRate: "18%",
      taxAmount: standardVat.toFixed(2),
      taxRateCode: "02",
      grossAmount: standardGross.toFixed(2),
      netAmount: standardNet.toFixed(2),
    });
  }
  if (exemptNet > 0) {
    taxDetails.push({
      taxCategory: "VAT",
      taxRate: "0%",
      taxAmount: "0.00",
      taxRateCode: "01",
      grossAmount: exemptNet.toFixed(2),
      netAmount: exemptNet.toFixed(2),
    });
  }

  const payWay = sale.payments.map((p, idx) => ({
    paymentMode: PAYMENT_MODE[p.payment_method] ?? "101",
    paymentAmount: p.amount.toFixed(2),
    orderNumber: String(idx + 1),
  }));

  return {
    basicInformation: {
      invoiceNo: sale.sale_number,
      antifakeCode: "",
      deviceNo: DEVICE_NO,
      issuedDate: efrisDateDisplay(issuedAt),
      operator: sale.teller_name ?? "Teller",
      currency: "UGX",
      exchangeRate: "1",
      invoiceType: "1",
      invoiceKind: "1",
      dataSource: "103",
      invoiceIndustryCode: "101",
      isBatch: "0",
    },
    sellerDetails: {
      tin: TIN,
      ninBrn: "",
      legalName: "INFRA MEDIK",
      businessName: "INFRA MEDIK",
      address: "Freedom City Mall, Namasuba, Entebbe Road, Kampala, Uganda",
      mobilePhone: "+256 700 000 000",
      linePhone: "",
      emailAddress: "",
      placeOfBusiness: "Kampala",
      referenceNumber: "",
      isCheckReferenceNumber: "0",
    },
    buyerDetails: {
      buyerTin: sale.customer_tin ?? "",
      buyerNinBrn: "",
      buyerPassportNum: "",
      buyerLegalName: sale.customer_name ?? "",
      buyerBusinessName: sale.customer_name ?? "",
      buyerAddress: "",
      buyerEmail: "",
      buyerMobilePhone: sale.customer_phone ?? "",
      buyerReferenceNo: "",
      buyerIsExempt: "0",
      buyerLocalPurchaseOrder: "",
    },
    goods,
    taxDetails,
    summary: {
      netAmount: sale.subtotal_before_vat.toFixed(2),
      taxAmount: sale.vat_amount.toFixed(2),
      grossAmount: sale.total_amount.toFixed(2),
      itemCount: String(sale.items.length),
      modeCode: "1",
      payWay,
      remarks: "",
    },
    extend: { reason: "", reasonCode: "" },
  };
}

// ─── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  let saleId: string;
  try {
    const body = await req.json();
    saleId = body.sale_id;
    if (!saleId) throw new Error("sale_id required");
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: corsHeaders },
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Fetch full sale detail ────────────────────────────────
  const { data: saleData, error: saleErr } = await admin
    .from("sales")
    .select(
      `
      id, sale_number, total_amount, vat_amount, subtotal_before_vat, created_at,
      profiles!teller_id ( full_name ),
      customers ( full_name, phone ),
      sale_items (
        product_id, quantity,
        unit_price_before_vat, vat_per_unit,
        line_total_before_vat, line_vat, line_total, is_vat_exempt,
        products ( name )
      ),
      payments ( payment_method, amount )
    `,
    )
    .eq("id", saleId)
    .single();

  if (saleErr || !saleData) {
    return new Response(
      JSON.stringify({
        success: false,
        error: saleErr?.message ?? "Sale not found",
      }),
      { status: 404, headers: corsHeaders },
    );
  }

  // Normalise the shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = saleData as any;
  const sale: SaleRow = {
    id: raw.id,
    sale_number: raw.sale_number,
    total_amount: raw.total_amount,
    vat_amount: raw.vat_amount,
    subtotal_before_vat: raw.subtotal_before_vat,
    created_at: raw.created_at,
    teller_name: raw.profiles?.full_name ?? null,
    customer_name: raw.customers?.full_name ?? null,
    customer_tin: null,
    customer_phone: raw.customers?.phone ?? null,
    items: (raw.sale_items ?? []).map((si: any) => ({
      product_id: si.product_id,
      product_name: si.products?.name ?? "Unknown product",
      quantity: si.quantity,
      unit_price_before_vat: si.unit_price_before_vat,
      vat_per_unit: si.vat_per_unit,
      line_total_before_vat: si.line_total_before_vat,
      line_vat: si.line_vat,
      line_total: si.line_total,
      is_vat_exempt: si.is_vat_exempt,
    })),
    payments: (raw.payments ?? []).map((p: any) => ({
      payment_method: p.payment_method,
      amount: p.amount,
    })),
  };

  // ── Build + encrypt T109 content ─────────────────────────
  const now = new Date();
  const content = buildT109Content(sale);
  const contentStr = JSON.stringify(content);
  let encryptedContent: string;
  let signature: string;

  try {
    encryptedContent = await aes256EcbEncryptB64(DEVICE_SECRET, contentStr);
    signature = await hmacSha256B64(DEVICE_SECRET, encryptedContent);
  } catch (cryptoErr) {
    await recordResult(
      admin,
      saleId,
      "failed",
      null,
      null,
      null,
      null,
      String(cryptoErr),
    );
    return new Response(
      JSON.stringify({ success: false, error: "Encryption failed" }),
      { status: 500, headers: corsHeaders },
    );
  }

  const efrisRequest = {
    data: {
      content: encryptedContent,
      signature,
      dataDescription: { codeType: "0", encryptCode: "1", zipCode: "0" },
    },
    globalInfo: {
      appId: "AP04",
      version: "1.1.20191201",
      dataExchangeId: randomDataExchangeId(),
      interfaceCode: "T109",
      requestCode: "TP",
      requestTime: efrisTimestamp(now),
      responseCode: "TA",
      userName: "admin",
      deviceMAC: "AAAAAAAAAAAA",
      deviceNo: DEVICE_NO,
      tin: TIN,
      brn: "",
      taxpayerID: "1",
      longitude: "32.61665",
      latitude: "0.36601",
      agentType: "0",
      extendField: {
        responseDateFormat: "dd/MM/yyyy",
        responseTimeFormat: "dd/MM/yyyy HH:mm:ss",
      },
    },
    returnStateInfo: { returnCode: "", returnMessage: "" },
  };

  // ── POST to URA EFRIS ─────────────────────────────────────
  let uraResponse: Record<string, unknown> = {};
  let efrisStatus: "submitted" | "failed" = "failed";
  let verificationCode: string | null = null;
  let qrData: string | null = null;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(EFRIS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(efrisRequest),
      signal: AbortSignal.timeout(15_000),
    });

    uraResponse = (await resp.json()) as Record<string, unknown>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const returnInfo = (uraResponse as any)?.returnStateInfo;
    if (returnInfo?.returnCode === "00") {
      efrisStatus = "submitted";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseData = (uraResponse as any)?.data;
      verificationCode =
        responseData?.antifakeCode ?? returnInfo.returnMessage ?? null;
      qrData = verificationCode
        ? `https://efris.ura.go.ug/efrisws/ws/verify?code=${verificationCode}`
        : null;
    } else {
      errorMessage = returnInfo?.returnMessage ?? "URA returned non-zero code";
    }
  } catch (fetchErr) {
    errorMessage = String(fetchErr);
  }

  // ── Record result in DB ───────────────────────────────────
  await recordResult(
    admin,
    saleId,
    efrisStatus,
    verificationCode,
    qrData,
    efrisRequest as Record<string, unknown>,
    uraResponse,
    errorMessage,
  );

  return new Response(
    JSON.stringify({
      success: efrisStatus === "submitted",
      verification_code: verificationCode,
      qr_data: qrData,
      error: errorMessage,
    }),
    { status: 200, headers: corsHeaders },
  );
});

// ─── DB helper ───────────────────────────────────────────────

async function recordResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  saleId: string,
  status: string,
  verificationCode: string | null,
  qrData: string | null,
  requestPayload: Record<string, unknown> | null,
  responsePayload: Record<string, unknown> | null,
  errorMessage: string | null,
) {
  await admin.rpc("record_efris_result", {
    p_sale_id: saleId,
    p_status: status,
    p_verification_code: verificationCode,
    p_qr_data: qrData,
    p_request_payload: requestPayload,
    p_response_payload: responsePayload,
    p_error: errorMessage,
  });
}
