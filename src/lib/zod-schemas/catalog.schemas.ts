import { z } from 'zod'

export const categorySchema = z.object({
  name:        z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional().nullable(),
})

export type CategoryFormValues = z.infer<typeof categorySchema>

export const countrySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim().toUpperCase() : ''))
    .refine((v) => v === '' || /^[A-Z]{2}$/.test(v), {
      message: 'Code must be two uppercase letters',
    }),
})

export type CountryFormValues = z.infer<typeof countrySchema>

export const manufacturerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  country_id: z.union([z.literal(''), z.string().uuid()]).optional(),
  website: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : ''))
    .refine((v) => v === '' || z.string().url().safeParse(v).success, {
      message: 'Invalid URL',
    }),
})

export type ManufacturerFormValues = z.infer<typeof manufacturerSchema>

export const supplierSchema = z.object({
  name:           z.string().min(1, 'Name is required').max(200),
  contact_person: z.string().max(200).optional().nullable(),
  phone:          z.string().max(30).optional().nullable(),
  email:          z.string().email('Invalid email').max(200).optional().nullable().or(z.literal('')),
  address:        z.string().max(500).optional().nullable(),
  tin:            z.string().max(50).optional().nullable(),
  notes:          z.string().max(1000).optional().nullable(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>
