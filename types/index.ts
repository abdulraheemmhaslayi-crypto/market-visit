// Shared TypeScript Type Definitions for Supervisor Field Visit Management System

export type UserRole =
  | "GM"
  | "BDM"
  | "Sales Manager"
  | "Admin"
  | "Sub-Admin"
  | "Supervisor"
  | "Fleet"
  | "Maintenance";
export type UserStatus = "Active" | "Inactive";
export type VisitStatus = "Draft" | "Submitted";
export type AssetType = "Chiller" | "Freezer";
export type ActionRequiredType =
  | "Select Status"
  | "Working"
  | "Not working"
  | "Working But Service Required"
  | "Outlet Own Asset Available"
  | "No Dandy Asset"
  | "Others"
  | "None";
export type NPDStatus = "Available" | "Not Available" | "Not Required";

export interface User {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  passwordHash: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string; // ISO string
  managerId?: string | null;
}

export interface Route {
  routeCode: string;
  routeName: string;
  channel: string;
  supervisorId?: string | null;
  managerId?: string | null;
  superName?: string; // persisted intended supervisor name, kept even when unmapped so it can be backfilled later
  managerName?: string; // transient for UI/parsing
}

export interface Customer {
  cust_rt_id: string;
  customerCode: string;
  customerName: string;
  classification: string; // legacy A-E (kept for backward compatibility)
  dairyClassification?: string | null; // A-E for Dairy vertical
  iceCreamClassification?: string | null; // A-E for Ice Cream vertical
  channel: string;
  routeCode: string;
}

export interface CustomerRouteMapping {
  cust_rt_id: string; // CustomerCode|RouteCode
  customerCode: string;
  routeCode: string;
}

export interface SKU {
  skuCode: string;
  skuName: string;
  type: string; // 'SKU', 'NPD'
  businessVertical?: string;
}

export interface PowerSKU {
  skuCode: string;
  skuName: string;
  channel: string;
}

export interface Visit {
  visitId: string;
  supervisorId: string; // User.id
  cust_rt_id: string;
  visit_type?: "Visit" | "No Visit";
  reason_category?: string;
  reason?: string;
  observation?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  status: VisitStatus;
  createdBy: string;
  visit_datetime: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  sosAsPerBda?: boolean | null;
  routeCode: string; // Transient helper
  customerCode: string; // Transient helper
  temperature?: number;
  tempInRange?: boolean;
  assetType?: AssetType;
  dairyClassification?: string | null;
  iceCreamClassification?: string | null;
}

export interface VisitAsset {
  assetId: string;
  visitId: string;
  assetType: AssetType;
  temperature?: number | null;
  tempInRange: boolean;
  actionRequired: ActionRequiredType;
  observation: string;
  isFirstInFlow: boolean;
  fefoFollowed: boolean;
  sizeModel?: string;
}

export interface VisitPhoto {
  photoId: string;
  visitId: string;
  category: "Dairy" | "Beverages" | "Ice Cream" | "Vegetables";
  cloudinaryUrl: string;
  publicId: string;
  uploadedAt: string; // ISO string
  appName?: string;
}

export interface NPDResponse {
  responseId: string;
  visitId: string;
  skuCode: string;
  status: NPDStatus;
}

export interface VisitPowerSkuResult {
  visitId: string;
  skuCode: string;
  status: NPDStatus;
}

export interface AuditLog {
  logId: string;
  user: string; // Email or Name
  action: string;
  entity: string;
  createdAt: string; // ISO string
}

// UI & API Transfer Objects

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  role: UserRole;
  status: UserStatus;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  supervisorId?: string;
  routeCode?: string;
}

export interface DashboardStats {
  totalVisits: number;
  noVisitCount: number;
  todayVisits: number;
  totalSupervisors: number;
  coveragePercent: number;
  tempBreachPercent: number;
  visitsPerDay: { date: string; count: number }[];
  coveragePerRoute: {
    routeCode: string;
    routeName: string;
    visited: number;
    total: number;
    coverage: number;
  }[];
  supervisorPerformance: {
    supervisorId: string;
    supervisorName: string;
    visitsCount: number;
    uniqueOutlets: number;
    breaches: number;
    coveragePercent: number;
  }[];
  temperatureBreaches: {
    visitId: string;
    customerName: string;
    assetType: AssetType;
    temperature: number;
    supervisorName: string;
    visitDate: string;
  }[];
}

// Wizard Local State for persistence
export interface VisitWizardState {
  visitId: string;
  routeCode: string;
  customerCode: string;
  customerName?: string;
  classification?: string;
  dairyClassification?: string | null;
  iceCreamClassification?: string | null;
  channel?: string;
  assetType?: AssetType;
  temperature?: number;
  tempInRange?: boolean;
  actionRequired?: ActionRequiredType;
  observation?: string;
  photos: {
    photoId: string;
    category: "Dairy" | "Beverages" | "Ice Cream" | "Vegetables";
    cloudinaryUrl: string;
    publicId: string;
    uploadedAt: string;
  }[];
  npdResponses: Record<string, NPDStatus>; // SKUCode -> NPDStatus
  powerSkuResults?: Record<string, NPDStatus>;
  assets?: VisitAsset[];
  sosAsPerBda?: boolean | null;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  currentStep: number;
  status: VisitStatus;
  visit_type?: "Visit" | "No Visit";
  reason_category?: string;
  reason?: string;
}

// Excel Import wizard status
export interface ImportPreviewRow {
  rowNum: number;
  data: Record<string, any>;
  errors: string[];
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  removed: number;
  failed: number;
  errors: { row: number; error: string }[];
  skipped?: number;
  unmappedSupervisors?: string[];
}
