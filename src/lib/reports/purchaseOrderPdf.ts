import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatDate, formatUGX } from '@/lib/formatters'
import type { PurchaseOrderFull } from '@/services/purchaseOrderService'
import { createElement } from 'react'

const styles = StyleSheet.create({
  page:     { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header:   { marginBottom: 20 },
  title:    { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  meta:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  metaCol:  { width: '48%' },
  label:    { fontSize: 8, color: '#999', textTransform: 'uppercase', marginBottom: 2 },
  value:    { fontSize: 10, marginBottom: 6 },
  table:    { marginTop: 10 },
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333',
    paddingBottom: 4, marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 3,
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  colProduct:  { flex: 2 },
  colUnit:     { width: 60 },
  colQty:      { width: 50, textAlign: 'right' },
  colCost:     { width: 80, textAlign: 'right' },
  colTotal:    { width: 80, textAlign: 'right' },
  bold:        { fontWeight: 'bold' },
  footer:      { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end' },
  totalLabel:  { fontSize: 12, fontWeight: 'bold', marginRight: 10 },
  totalValue:  { fontSize: 12, fontWeight: 'bold' },
  notes:       { marginTop: 20, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4 },
})

function PODocument({ po }: { po: PurchaseOrderFull }) {
  const items = po.purchase_order_items ?? []

  return createElement(Document, null,
    createElement(Page, { size: 'A4', style: styles.page },
      // Header
      createElement(View, { style: styles.header },
        createElement(Text, { style: styles.title }, `Purchase Order: ${po.po_number}`),
        createElement(Text, { style: styles.subtitle }, `Generated ${formatDate(new Date().toISOString())}`),
      ),
      // Meta info
      createElement(View, { style: styles.meta },
        createElement(View, { style: styles.metaCol },
          createElement(Text, { style: styles.label }, 'SUPPLIER'),
          createElement(Text, { style: styles.value }, po.suppliers?.name ?? '—'),
          createElement(Text, { style: styles.label }, 'ORDER DATE'),
          createElement(Text, { style: styles.value }, formatDate(po.order_date)),
        ),
        createElement(View, { style: styles.metaCol },
          createElement(Text, { style: styles.label }, 'STATUS'),
          createElement(Text, { style: styles.value }, po.status.replace('_', ' ').toUpperCase()),
          createElement(Text, { style: styles.label }, 'EXPECTED DELIVERY'),
          createElement(Text, { style: styles.value }, po.expected_delivery_date ? formatDate(po.expected_delivery_date) : '—'),
        ),
      ),
      // Table header
      createElement(View, { style: styles.table },
        createElement(View, { style: styles.tableHeader },
          createElement(Text, { style: [styles.colProduct, styles.bold] }, 'Product'),
          createElement(Text, { style: [styles.colUnit, styles.bold] }, 'Unit'),
          createElement(Text, { style: [styles.colQty, styles.bold] }, 'Qty'),
          createElement(Text, { style: [styles.colCost, styles.bold] }, 'Cost/Unit'),
          createElement(Text, { style: [styles.colTotal, styles.bold] }, 'Total'),
        ),
        // Table rows
        ...items.map((item) =>
          createElement(View, { key: item.id, style: styles.tableRow },
            createElement(Text, { style: styles.colProduct }, item.products?.name ?? '—'),
            createElement(Text, { style: styles.colUnit }, item.product_units?.unit_name ?? '—'),
            createElement(Text, { style: styles.colQty }, String(item.quantity_ordered)),
            createElement(Text, { style: styles.colCost }, formatUGX(item.cost_price_per_unit)),
            createElement(Text, { style: styles.colTotal }, formatUGX(item.line_total)),
          ),
        ),
      ),
      // Footer totals
      createElement(View, { style: styles.footer },
        createElement(Text, { style: styles.totalLabel }, 'Subtotal:'),
        createElement(Text, { style: styles.totalValue }, formatUGX(po.subtotal)),
      ),
      // Notes
      po.notes
        ? createElement(View, { style: styles.notes },
            createElement(Text, { style: styles.label }, 'NOTES'),
            createElement(Text, null, po.notes),
          )
        : null,
    ),
  )
}

export async function generatePOPdf(po: PurchaseOrderFull): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(PODocument, { po }) as any
  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${po.po_number}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
