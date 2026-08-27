import { z } from 'zod';

export const visitPhotoSchema = z.object({
  photoId: z.string(),
  category: z.enum(['Dairy', 'Beverages', 'Ice Cream', 'Vegetables'] as const),
  cloudinaryUrl: z.string().url({ message: 'Invalid photo URL' }),
  publicId: z.string(),
  uploadedAt: z.string(),
});

export const visitAssetSchema = z.object({
  assetId: z.string(),
  assetType: z.enum(['Chiller', 'Freezer'] as const),
  temperature: z.number({ message: 'Temperature must be a number' }),
  tempInRange: z.boolean(),
  actionRequired: z.enum(['Select Status', 'Working', 'Not working', 'Working But Service Required', 'Outlet Own Asset Available', 'No Dandy Asset', 'Others', 'None'] as const),
  observation: z.string().optional().default(''),
  isFirstInFlow: z.boolean().optional().default(false),
  fefoFollowed: z.boolean().optional().default(false),
});

export const visitSchema = z.object({
  visitId: z.string(),
  visit_type: z.enum(['Visit', 'No Visit'] as const).default('Visit'),
  cust_rt_id: z.string().optional().or(z.literal('')).default(''),
  latitude: z.number().optional().default(0),
  longitude: z.number().optional().default(0),
  accuracy: z.number().optional().default(0),
  status: z.enum(['Draft', 'Submitted'] as const),
  assets: z.array(visitAssetSchema).default([]),
  photos: z.array(visitPhotoSchema).default([]),
  powerSkuResults: z.record(z.string(), z.enum(['Available', 'Not Available', 'Not Required'] as const)).default({}),
  npdResponses: z.record(z.string(), z.enum(['Available', 'Not Available', 'Not Required'] as const)).default({}),
  sosAsPerBda: z.boolean().nullable().optional(),
  visit_datetime: z.string().optional(),
  reason_category: z.string().optional(),
  reason: z.string().optional(),
  observation: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.visit_type === 'Visit' && (!data.cust_rt_id || data.cust_rt_id.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cust_rt_id'],
      message: 'Customer selection is required for a visit.',
    });
  }

  if (data.visit_type === 'No Visit') {
    if (!data.reason_category || data.reason_category.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason_category'],
        message: 'Please select a reason category for no visit.',
      });
    }
  }
});

export const visitDraftSchema = z.object({
  visitId: z.string(),
  visit_type: z.enum(['Visit', 'No Visit'] as const).optional().default('Visit'),
  cust_rt_id: z.string().optional().or(z.literal('')).default(''),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
  status: z.enum(['Draft', 'Submitted'] as const),
  assets: z.array(visitAssetSchema.partial({
    assetType: true,
    temperature: true,
    tempInRange: true,
    actionRequired: true,
    isFirstInFlow: true,
    fefoFollowed: true,
  }).extend({
    observation: z.string().optional().default(''),
  })).default([]),
  photos: z.array(visitPhotoSchema).default([]),
  powerSkuResults: z.record(z.string(), z.enum(['Available', 'Not Available', 'Not Required'] as const)).optional().default({}),
  npdResponses: z.record(z.string(), z.enum(['Available', 'Not Available', 'Not Required'] as const)).optional().default({}),
  sosAsPerBda: z.boolean().nullable().optional(),
  visit_datetime: z.string().optional(),
  reason_category: z.string().optional(),
  reason: z.string().optional(),
  observation: z.string().optional(),
});

export type VisitInput = z.infer<typeof visitSchema>;
export type VisitDraftInput = z.infer<typeof visitDraftSchema>;
export type VisitPhotoInput = z.infer<typeof visitPhotoSchema>;
export type VisitAssetInput = z.infer<typeof visitAssetSchema>;

