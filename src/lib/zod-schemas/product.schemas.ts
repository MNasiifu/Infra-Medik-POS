import { z } from 'zod'

export const DOSAGE_FORMS = [
  'tablet', 'capsule', 'syrup', 'dental foam', 'suspension', 'cream',
  'ointment', 'gel', 'lip balm', 'topical oil', 'body butter', 'herbal tea', 'soap bar', 'shampoo', 'topical liquid', 'topical cream', 'topical balm',
  'injection', 'drops', 'powder', 'make-up brush', 'make-up sponge', 'Pre-lubricated latex condom',
  'inhaler', 'patch', 'suppository', 'liquid topical facial toner', 'liquid exfoliating mask', 'other',
] as const

export const productSchema = z.object({
  name:            z.string().min(2, 'Product name must be at least 2 characters').max(200),
  generic_name:    z.string().max(200).optional().nullable(),
  category_id:     z.string().uuid().optional().nullable(),
  manufacturer_id: z.string().uuid().optional().nullable(),
  country_id:      z.string().uuid().optional().nullable(),
  supplier_id:     z.string().uuid().optional().nullable(),
  dosage_form:     z.enum(DOSAGE_FORMS).optional().nullable(),
  strength:        z.string().max(100).optional().nullable(),
  description:     z.string().max(1000).optional().nullable(),
  is_vat_exempt:   z.boolean().default(false),
})

export type ProductFormValues = z.infer<typeof productSchema>

export const productUnitSchema = z.object({
  unit_name:         z.string().min(1, 'Unit name is required').max(50),
  conversion_factor: z.coerce.number().positive('Must be positive').default(1),
  price_before_vat:  z.coerce.number().min(0, 'Price must be 0 or greater'),
  vat_amount:        z.coerce.number().min(0).default(0),
  cost_price:        z.coerce.number().min(0).default(0),
  is_default:        z.boolean().default(false),
})

export type ProductUnitFormValues = z.infer<typeof productUnitSchema>

export const createProductSchema = z.object({
  product: productSchema,
  units: z
    .array(productUnitSchema)
    .min(1, 'At least one selling unit is required'),
  barcodes: z.array(z.string()).default([]),
})

export type CreateProductFormValues = z.infer<typeof createProductSchema>

export const categorySchema = z.object({
  name:        z.string().min(2, 'Category name required').max(100),
  description: z.string().max(300).optional().nullable(),
})

export const manufacturerSchema = z.object({
  name:       z.string().min(2, 'Manufacturer name required').max(200),
  country_id: z.string().uuid().optional().nullable(),
})
