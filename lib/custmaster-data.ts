import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

export interface CustMasterRoute {
  routeCode: string;
  routeName: string;
  managerName: string;
  superName: string;
}

export interface CustMasterCustomer {
  customerCode: string;
  customerName: string;
  routeCode: string;
  cust_rt_id: string;
  managerName: string;
  superName: string;
  classification: string;
  channel: string;
}

export interface CustMasterPayload {
  managers: string[];
  supervisors: string[];
  classifications: string[];
  routes: CustMasterRoute[];
  customers: CustMasterCustomer[];
  managerSupervisorMap: Record<string, string[]>;
  supervisorRoutesMap: Record<string, string[]>;
  managerRoutesMap: Record<string, string[]>;
  routeManagerMap: Record<string, string>;
  routeSupervisorMap: Record<string, string>;
  customerClassificationMap: Record<string, string>;
}

let cachedCustMaster: CustMasterPayload | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function findCustMasterFile(): string | null {
  const candidatePaths = [
    path.join(process.cwd(), 'data', 'CUSTMASTER.xlsx'),
    path.join(process.cwd(), '..', 'CUSTMASTER.xlsx'),
    path.join(process.cwd(), '..', '..', 'CUSTMASTER.xlsx'),
    'D:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/CUSTMASTER.xlsx',
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/CUSTMASTER.xlsx',
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function loadCustomerClassifications(): Map<string, string> {
  const map = new Map<string, string>();
  const jsonPath = path.join(process.cwd(), 'data', 'customers.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.customerCode) {
            const raw = String(item.customerCode).trim().toUpperCase();
            const cls = (item.classification || item.dairyClassification || 'C').trim().toUpperCase();
            if (cls && cls !== '-') {
              map.set(raw, cls);
              map.set(raw.replace(/^C/, ''), cls);
              map.set(`C${raw.replace(/^C/, '')}`, cls);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error reading customers.json for classification mapping:', e);
    }
  }
  return map;
}

export function getCustMasterData(forceReload = false): CustMasterPayload {
  const now = Date.now();
  if (!forceReload && cachedCustMaster && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedCustMaster;
  }

  const filePath = findCustMasterFile();
  const classMap = loadCustomerClassifications();

  const managerSet = new Set<string>();
  const supervisorSet = new Set<string>();
  const classificationSet = new Set<string>(['A', 'B', 'C', 'D', 'E']);
  const routeMap = new Map<string, CustMasterRoute>();
  const customerList: CustMasterCustomer[] = [];
  const managerSupervisorMap: Record<string, string[]> = {};
  const supervisorRoutesMap: Record<string, string[]> = {};
  const managerRoutesMap: Record<string, string[]> = {};
  const routeManagerMap: Record<string, string> = {};
  const routeSupervisorMap: Record<string, string> = {};
  const customerClassificationMap: Record<string, string> = {};

  if (filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const wb = xlsx.read(buffer, { type: 'buffer' });
      if (wb.SheetNames.length > 0) {
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet) as any[];

        for (const r of rows) {
          const rtRaw = String(r['Route Code'] || '').trim().toUpperCase();
          const custCodeRaw = String(r['Customer Code'] || '').trim().toUpperCase();
          const custName = String(r['Customer Name'] || '').trim();
          const mgrRaw = String(r['MANAGER'] || r['NEW MANAGER'] || '').trim().toUpperCase();
          const supRaw = String(r['Supervisor'] || r['SV'] || '').trim().toUpperCase();
          const channelRaw = String(r['Segment_Fin(120MT)'] || r['CHANNEL'] || 'GT').trim().toUpperCase();

          const isInternal = rtRaw === 'DIS001' || mgrRaw === 'INTERNAL' || supRaw === 'INTERNAL';
          const isExcludedMgr = mgrRaw === 'EXP MANAGER' || mgrRaw === 'INST MANAGER' || !mgrRaw;

          const validManager = !isInternal && !isExcludedMgr ? mgrRaw : '';
          const validSupervisor = !isInternal && supRaw ? supRaw : '';

          if (validManager) managerSet.add(validManager);
          if (validSupervisor) supervisorSet.add(validSupervisor);

          // Route mappings
          if (rtRaw && !isInternal) {
            if (!routeMap.has(rtRaw)) {
              routeMap.set(rtRaw, {
                routeCode: rtRaw,
                routeName: `Route ${rtRaw}`,
                managerName: validManager,
                superName: validSupervisor,
              });
            } else {
              const existing = routeMap.get(rtRaw)!;
              if (!existing.managerName && validManager) existing.managerName = validManager;
              if (!existing.superName && validSupervisor) existing.superName = validSupervisor;
            }

            if (validManager) {
              routeManagerMap[rtRaw] = validManager;
              if (!managerRoutesMap[validManager]) managerRoutesMap[validManager] = [];
              if (!managerRoutesMap[validManager].includes(rtRaw)) managerRoutesMap[validManager].push(rtRaw);
            }

            if (validSupervisor) {
              routeSupervisorMap[rtRaw] = validSupervisor;
              if (!supervisorRoutesMap[validSupervisor]) supervisorRoutesMap[validSupervisor] = [];
              if (!supervisorRoutesMap[validSupervisor].includes(rtRaw)) supervisorRoutesMap[validSupervisor].push(rtRaw);
            }

            if (validManager && validSupervisor) {
              if (!managerSupervisorMap[validManager]) managerSupervisorMap[validManager] = [];
              if (!managerSupervisorMap[validManager].includes(validSupervisor)) {
                managerSupervisorMap[validManager].push(validSupervisor);
              }
            }
          }

          // Customer Classification
          let cls = classMap.get(custCodeRaw) || classMap.get(custCodeRaw.replace(/^C/, '')) || 'C';
          if (!cls || cls === '-') cls = 'C';
          classificationSet.add(cls);
          customerClassificationMap[custCodeRaw] = cls;

          if (custCodeRaw) {
            customerList.push({
              customerCode: custCodeRaw,
              customerName: custName,
              routeCode: rtRaw,
              cust_rt_id: r['Cust_Rt_ID'] || `${custCodeRaw}|${rtRaw}`,
              managerName: validManager,
              superName: validSupervisor,
              classification: cls,
              channel: channelRaw,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse CUSTMASTER.xlsx:', err);
    }
  }

  // Sort maps
  Object.keys(managerSupervisorMap).forEach((m) => managerSupervisorMap[m].sort());
  Object.keys(managerRoutesMap).forEach((m) => managerRoutesMap[m].sort());
  Object.keys(supervisorRoutesMap).forEach((s) => supervisorRoutesMap[s].sort());

  const managers = Array.from(managerSet).sort();
  const supervisors = Array.from(supervisorSet).sort();
  const classifications = Array.from(classificationSet).sort();
  const routes = Array.from(routeMap.values()).sort((a, b) => a.routeCode.localeCompare(b.routeCode));

  cachedCustMaster = {
    managers,
    supervisors,
    classifications,
    routes,
    customers: customerList,
    managerSupervisorMap,
    supervisorRoutesMap,
    managerRoutesMap,
    routeManagerMap,
    routeSupervisorMap,
    customerClassificationMap,
  };

  lastCacheTime = now;
  return cachedCustMaster;
}
