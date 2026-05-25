import type { CartLine } from "@/store/cartStore";
import type { CompleteSaleResult, PaymentMethod } from "@/types/database.types";
import type { PaymentEntry } from "@/hooks/pos/useCompleteSale";
import { formatUGX } from "./formatters";

export interface ReceiptData {
  // Shop
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  tin: string;

  // Sale
  saleNumber: string;
  dateTime: string;
  tellerName: string;

  // Customer
  customerName: string | null;

  // Lines
  lines: Array<{
    name: string;
    unitName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    isVatExempt: boolean;
  }>;

  // Totals
  subtotalBeforeVat: number;
  totalVat: number;
  grandTotal: number;

  // Payments
  payments: Array<{ method: PaymentMethod; amount: number; label: string }>;
  amountTendered: number;
  change: number;

  // EFRIS
  efrisVerificationCode: string | null;
  efrisQrData: string | null;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
};

export function buildReceipt({
  result,
  lines,
  payments,
  customerName,
  tellerName,
  grandTotal,
  amountTendered,
  efrisVerificationCode = null,
  efrisQrData = null,
}: {
  result: CompleteSaleResult;
  lines: CartLine[];
  payments: PaymentEntry[];
  customerName: string | null;
  tellerName: string;
  grandTotal: number;
  efrisVerificationCode?: string | null;
  efrisQrData?: string | null;
  amountTendered: number;
}): ReceiptData {

  return {
    shopName: "INFRA MEDIK",
    shopAddress: "Freedom City Mall, Namasuba, Entebbe Road\nKampala, Uganda",
    shopPhone: "+256 700 000 000",
    tin: "10756690689",

    saleNumber: result.sale_number,
    dateTime: new Date().toLocaleString("en-UG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    tellerName,

    customerName,

    lines: lines.map((l) => ({
      name: l.productName + (l.genericName ? ` (${l.genericName})` : ""),
      unitName: l.unitName,
      qty: l.quantity,
      unitPrice: l.unitPriceInclusive,
      lineTotal: l.lineTotal,
      isVatExempt: l.isVatExempt,
    })),

    subtotalBeforeVat: result.total_amount - result.vat_amount,
    totalVat: result.vat_amount,
    grandTotal: result.total_amount,

    payments: payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      label: PAYMENT_LABELS[p.method],
    })),
    amountTendered,
    change: Math.max(0, amountTendered - grandTotal),

    efrisVerificationCode,
    efrisQrData,
  };
}

// Build an 80mm HTML receipt for browser print / QZ Tray HTML print
export function receiptToHtml(r: ReceiptData): string {
  const divider =
    '<hr style="border:none;border-top:1px dashed #000;margin:4px 0">';

  const lineRows = r.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:1px 0">${l.name}<br><small>${l.qty} × ${l.unitName}</small></td>
          <td style="text-align:right;white-space:nowrap;padding:1px 0">${formatUGX(l.lineTotal)}</td>
        </tr>`,
    )
    .join("");

  const paymentRows = r.payments
    .map(
      (p) =>
        `<tr>
          <td>${p.label}</td>
          <td style="text-align:right">${formatUGX(p.amount)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    width: 80mm;
    padding: 6px;
    color: #000;
  }
  h2 { font-size: 14px; text-align: center; letter-spacing: 2px; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  .total-row td { font-weight: bold; }
  .grand-row td { font-size: 13px; font-weight: bold; }
  .cash-section { 
    border: 1px solid #2E7D32; 
    padding: 6px; 
    margin: 4px 0;
    background-color: #f0f7f0;
    border-radius: 2px;
  }
  .cash-row { 
    display: flex; 
    justify-content: space-between; 
    font-weight: bold;
    margin: 2px 0;
    color: #2E7D32;
  }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { padding: 2px; }
  }
</style>
</head>
<body>
  <h2>${r.shopName}</h2>
  <div class="center" style="font-size:10px;margin:2px 0">${r.shopAddress.replace("\n", "<br>")}</div>
  <div class="center" style="font-size:10px">Tel: ${r.shopPhone} | TIN: ${r.tin}</div>
  ${divider}
  <table>
    <tr><td>Receipt #</td><td style="text-align:right">${r.saleNumber}</td></tr>
    <tr><td>Date</td><td style="text-align:right">${r.dateTime}</td></tr>
    <tr><td>Teller</td><td style="text-align:right">${r.tellerName}</td></tr>
    ${r.customerName ? `<tr><td>Customer</td><td style="text-align:right">${r.customerName}</td></tr>` : ""}
  </table>
  ${divider}
  <table>
    <thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  ${divider}
  <table>
    <tr><td>Sub-total (excl. VAT)</td><td style="text-align:right">${formatUGX(r.subtotalBeforeVat)}</td></tr>
    <tr><td>VAT (18%)</td><td style="text-align:right">${formatUGX(r.totalVat)}</td></tr>
    <tr class="grand-row"><td>TOTAL</td><td style="text-align:right">${formatUGX(r.grandTotal)}</td></tr>
  </table>
  ${divider}
  <table>
    ${paymentRows}
  </table>
  ${divider}
  <div class="cash-section">
    <div class="cash-row">
      <span>CASH RECEIVED</span>
      <span>${formatUGX(r.amountTendered)}</span>
    </div>
    ${
      r.change > 0
        ? `<div class="cash-row">
      <span>CHANGE DUE</span>
      <span>${formatUGX(r.change)}</span>
    </div>`
        : ""
    }
  </div>
  ${divider}
  ${
    r.efrisVerificationCode
      ? `<div class="center" style="margin-top:4px;font-size:9px">
        <strong>EFRIS VERIFIED — URA</strong><br>
        Code: ${r.efrisVerificationCode}
      </div>`
      : `<div class="center" style="margin-top:4px;font-size:9px;color:#888">
        EFRIS: Pending URA verification
      </div>`
  }
  ${divider}
  <div class="center" style="margin-top:6px;font-size:10px">
    Thank you for your purchase!<br>
    Goods once sold cannot be returned<br>
    without a valid receipt.
  </div>
</body>
</html>`;
}
