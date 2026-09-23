// In-Memory Master Data Cache for Dashboard

export interface MasterCache {
  timestamp: number;
  customers: any[];
  customerMap: Map<string, any>;
  uniqueCustomers: { customerName: string; routeCode: string }[];
  routeRows: any[];
  routeMap: Map<string, any>;
  allManagers: string[];
  allSupervisors: string[];
  managerSupervisorMap: Record<string, string[]>;
  skuMap: Map<string, any>;
  powerSkuMap: Map<string, any>;
  dbUsers: any[];
  userMap: Map<string, { name: string; managerName: string }>;
}

let masterCache: MasterCache | null = null;

export function getCachedMasterData(): MasterCache | null {
  return masterCache;
}

export function setCachedMasterData(cache: MasterCache) {
  masterCache = cache;
}

export function invalidateDashboardMasterCache() {
  masterCache = null;
}
