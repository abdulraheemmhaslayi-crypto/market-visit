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
  dairyClassification?: string;
  iceCreamClassification?: string;
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
let cachedClassMap: Map<string, CustomerClassificationInfo> | null = null;
let lastClassMapTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

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

interface CustomerClassificationInfo {
  classification: string;
  dairyClassification?: string;
  iceCreamClassification?: string;
  channel?: string;
}

function getVariants(code: string): string[] {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return [];
  const rawNum = clean.replace(/^C/i, '');
  const unpadded = rawNum.replace(/^0+/, '');
  const padded5 = rawNum.padStart(5, '0');

  return Array.from(
    new Set([
      clean,
      rawNum,
      unpadded,
      `C${rawNum}`,
      `C${unpadded}`,
      padded5,
      `C${padded5}`,
    ].filter(Boolean))
  );
}

function loadCustomerClassifications(forceReload = false): Map<string, CustomerClassificationInfo> {
  const now = Date.now();
  if (!forceReload && cachedClassMap && now - lastClassMapTime < CACHE_TTL_MS) {
    return cachedClassMap;
  }
  const map = new Map<string, CustomerClassificationInfo>();

  const setVariantInfo = (code: string, info: Partial<CustomerClassificationInfo>) => {
    const variants = getVariants(code);
    for (const v of variants) {
      const existing = map.get(v) || { classification: 'C' };
      if (info.classification) existing.classification = info.classification;
      if (info.dairyClassification) existing.dairyClassification = info.dairyClassification;
      if (info.iceCreamClassification) existing.iceCreamClassification = info.iceCreamClassification;
      if (info.channel) existing.channel = info.channel;
      map.set(v, existing);
    }
  };

  // 1. Load from data/customers.json
  const jsonPath = path.join(process.cwd(), 'data', 'customers.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item.customerCode) {
            const cls = (item.classification || item.dairyClassification || 'C').trim().toUpperCase();
            setVariantInfo(item.customerCode, {
              classification: cls && cls !== '-' ? cls : 'C',
              dairyClassification: item.dairyClassification || undefined,
              iceCreamClassification: item.iceCreamClassification || undefined,
              channel: item.channel ? String(item.channel).trim().toUpperCase() : undefined,
            });
          }
        }
      }
    } catch (e) {
      console.error('Error reading customers.json for classification mapping:', e);
    }
  }

  // 2. Load from classification excel files if present
  const candidateClassFiles: string[] = [
    path.join(process.cwd(), 'data', 'Customer_Classification_DUMMY.xlsx'),
    path.join(process.cwd(), 'data', 'Master_Classification.xlsx'),
    path.join(process.cwd(), 'data', 'Customer_Classification.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Customer_Classification_DUMMY.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Master_Classification.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Customer_Classification.xlsx'),
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/Customer_Classification.xlsx',
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/Master_Classification.xlsx',
  ];

  const searchDirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'public', 'uploads'),
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW',
  ];

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.xlsx') && (file.toLowerCase().includes('class') || file.toLowerCase().includes('grade'))) {
            const fullPath = path.join(dir, file);
            if (!candidateClassFiles.includes(fullPath)) {
              candidateClassFiles.push(fullPath);
            }
          }
        }
      } catch (e) {}
    }
  }

  for (const cPath of candidateClassFiles) {
    if (fs.existsSync(cPath)) {
      try {
        const buf = fs.readFileSync(cPath);
        const wb = xlsx.read(buf, { type: 'buffer' });
        if (wb.SheetNames.length > 0) {
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = xlsx.utils.sheet_to_json(sheet) as any[];
          for (const row of rows) {
            const code = row['Customer Code'] || row['CustomerCode'] || row['customercode'] || row['Code'];
            const cls = row['Classification'] || row['Class'] || row['Grade'];
            const vert = row['Business Vertical'] || row['BusinessVertical'] || row['Vertical'];
            const ch = row['Channel'] || row['CHANNEL'];

            if (code && cls) {
              const codeStr = String(code).trim().toUpperCase();
              const clsStr = String(cls).trim().toUpperCase();
              const vertStr = String(vert || '').trim().toLowerCase();
              const chStr = ch ? String(ch).trim().toUpperCase() : undefined;

              const isDairy = vertStr.includes('dairy');
              const isIce = vertStr.includes('ice');

              setVariantInfo(codeStr, {
                classification: clsStr !== '-' ? clsStr : undefined,
                dairyClassification: isDairy ? clsStr : undefined,
                iceCreamClassification: isIce ? clsStr : undefined,
                channel: chStr,
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed reading classification excel file:', cPath, err);
      }
    }
  }

  cachedClassMap = map;
  lastClassMapTime = Date.now();
  return map;
}

export function getCustMasterData(forceReload = false): CustMasterPayload {
  const now = Date.now();
  if (!forceReload && cachedCustMaster && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedCustMaster;
  }

  const filePath = findCustMasterFile();
  const classMap = loadCustomerClassifications(forceReload);

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

          let validManager = !isInternal && !isExcludedMgr ? mgrRaw : '';
          let validSupervisor = !isInternal && supRaw ? supRaw : '';

          // Disambiguate Saifullah (Manager: Adnan, Modern Trade MTD/MTI) vs Saif (Manager: Ashfaq, Traditional Trade TRD/TRI)
          if (validSupervisor === 'SAIF' || validSupervisor === 'SAIFULLAH') {
            if (validManager === 'ADNAN' || rtRaw.startsWith('MT') || ['MTD207', 'MTD210', 'MTD213', 'MTD218'].includes(rtRaw)) {
              validSupervisor = 'SAIFULLAH';
              validManager = 'ADNAN';
            } else if (validManager === 'ASHFAQ' || rtRaw.startsWith('TR') || ['TRD104', 'TRD109', 'TRD129', 'TRD144', 'TRD158', 'TRI308'].includes(rtRaw)) {
              validSupervisor = 'SAIF';
              validManager = 'ASHFAQ';
            }
          }

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

          // Customer Classification & Channel resolution from Customer_Classification
          let clsInfo: CustomerClassificationInfo | undefined;
          for (const v of getVariants(custCodeRaw)) {
            const found = classMap.get(v);
            if (found) {
              clsInfo = found;
              break;
            }
          }

          const dairyCls = clsInfo?.dairyClassification;
          const iceCls = clsInfo?.iceCreamClassification;
          let cls = clsInfo?.classification || (dairyCls && dairyCls !== '-' ? dairyCls : (iceCls && iceCls !== '-' ? iceCls : 'C'));
          if (!cls || cls === '-') cls = 'C';
          classificationSet.add(cls);
          customerClassificationMap[custCodeRaw] = cls;

          let finalChannel = channelRaw;
          if (!finalChannel || finalChannel === 'GENERAL TRADE' || finalChannel === 'GENERAL STORE' || finalChannel === 'GT') {
            finalChannel = clsInfo?.channel || 'TT';
          }
          if (!finalChannel || finalChannel === 'GT') finalChannel = 'TT';

          if (custCodeRaw) {
            customerList.push({
              customerCode: custCodeRaw,
              customerName: custName,
              routeCode: rtRaw,
              cust_rt_id: r['Cust_Rt_ID'] || `${custCodeRaw}|${rtRaw}`,
              managerName: validManager,
              superName: validSupervisor,
              classification: cls,
              dairyClassification: dairyCls || undefined,
              iceCreamClassification: iceCls || undefined,
              channel: finalChannel,
            });
          }
        }
        // Ensure MTI routes under Modern Trade (Adnan) are present
        const knownMtiRoutes: Record<string, string> = {
          MTI401: 'MOHSIN',
          MTI402: 'ASAD',
          MTI403: 'SAIFULLAH',
          MTI404: 'KISHAN',
          MTI405: 'JAVED',
          MTI406: 'RASHWIN',
        };
        Object.entries(knownMtiRoutes).forEach(([mti, sup]) => {
          if (!routeMap.has(mti)) {
            routeMap.set(mti, {
              routeCode: mti,
              routeName: `Route ${mti}`,
              managerName: 'ADNAN',
              superName: sup,
            });
            routeManagerMap[mti] = 'ADNAN';
            routeSupervisorMap[mti] = sup;
            if (!supervisorRoutesMap[sup]) supervisorRoutesMap[sup] = [];
            if (!supervisorRoutesMap[sup].includes(mti)) supervisorRoutesMap[sup].push(mti);
            if (!managerRoutesMap['ADNAN']) managerRoutesMap['ADNAN'] = [];
            if (!managerRoutesMap['ADNAN'].includes(mti)) managerRoutesMap['ADNAN'].push(mti);
            supervisorSet.add(sup);
          }
        });
      }
    } catch (err) {
      console.error('Failed to parse CUSTMASTER.xlsx:', err);
    }
  }

  // Ensure SAIFULLAH is mapped strictly to ADNAN and SAIF strictly to ASHFAQ
  if (!managerSupervisorMap['ADNAN']) managerSupervisorMap['ADNAN'] = [];
  if (!managerSupervisorMap['ADNAN'].includes('SAIFULLAH')) managerSupervisorMap['ADNAN'].push('SAIFULLAH');
  managerSupervisorMap['ADNAN'] = managerSupervisorMap['ADNAN'].filter((s) => s !== 'SAIF');

  if (!managerSupervisorMap['ASHFAQ']) managerSupervisorMap['ASHFAQ'] = [];
  if (!managerSupervisorMap['ASHFAQ'].includes('SAIF')) managerSupervisorMap['ASHFAQ'].push('SAIF');
  managerSupervisorMap['ASHFAQ'] = managerSupervisorMap['ASHFAQ'].filter((s) => s !== 'SAIFULLAH');

  supervisorSet.add('SAIFULLAH');
  supervisorSet.add('SAIF');

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
