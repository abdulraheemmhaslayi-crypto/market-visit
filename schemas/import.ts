import { z } from 'zod';

export const routeImportSchema = z.object({
  RouteCode: z.string().min(1, { message: 'RouteCode is required' }),
  RouteName: z.string().min(1, { message: 'RouteName is required' }),
});

export const customerImportSchema = z.object({
  CustomerCode: z.string().min(1, { message: 'CustomerCode is required' }),
  CustomerName: z.string().min(1, { message: 'CustomerName is required' }),
  Classification: z.string().min(1, { message: 'Classification is required' }),
  Channel: z.string().min(1, { message: 'Channel is required' }),
  BusinessVertical: z.string().min(1, { message: 'Business vertical is required' }),
});

export const customerRouteMappingImportSchema = z.object({
  CustomerCode: z.string().min(1, { message: 'CustomerCode is required' }),
  RouteCode: z.string().min(1, { message: 'RouteCode is required' }),
});

export const skuImportSchema = z.object({
  SKUCode: z.string().min(1, { message: 'SKUCode is required' }),
  SKUName: z.string().min(1, { message: 'SKUName is required' }),
  BusinessVertical: z.string().optional(),
});

// Zod schemas for CUSTMASTER and Classification files
export const custMasterSchema = z.object({
  CustomerCode: z.string().min(1, { message: 'CustomerCode is required' }),
  CustomerName: z.string().min(1, { message: 'CustomerName is required' }),
  RouteCode: z.string().min(1, { message: 'RouteCode is required' }),
});

export const customerClassificationSchema = z.object({
  CustomerCode: z.string().min(1, { message: 'CustomerCode is required' }),
  Classification: z.string().min(1, { message: 'Classification is required' }),
  Channel: z.string().min(1, { message: 'Channel is required' }),
  BusinessVertical: z.string().min(1, { message: 'Business vertical is required' }),
});

export type RouteImportInput = z.infer<typeof routeImportSchema>;
export type CustomerImportInput = z.infer<typeof customerImportSchema>;
export type CustomerRouteMappingImportInput = z.infer<typeof customerRouteMappingImportSchema>;
export type SKUImportInput = z.infer<typeof skuImportSchema>;
export type CustMasterInput = z.infer<typeof custMasterSchema>;
export type CustomerClassificationInput = z.infer<typeof customerClassificationSchema>;
