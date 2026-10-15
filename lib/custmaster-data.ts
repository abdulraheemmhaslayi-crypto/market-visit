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
  rtm?: string;
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
  rtms?: string[];
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
  if (clean.startsWith('NAME:')) return [clean];
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

function getRowVal(r: any, ...keys: string[]): string {
  if (!r) return '';
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
      return String(r[k]).trim();
    }
  }
  const rKeys = Object.keys(r);
  for (const k of keys) {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = rKeys.find((rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanK);
    if (found && r[found] !== undefined && r[found] !== null && String(r[found]).trim() !== '') {
      return String(r[found]).trim();
    }
  }
  return '';
}

export function loadCustomerClassifications(forceReload = false): Map<string, CustomerClassificationInfo> {
  const now = Date.now();
  if (!forceReload && cachedClassMap && now - lastClassMapTime < CACHE_TTL_MS) {
    return cachedClassMap;
  }
  const map = new Map<string, CustomerClassificationInfo>();

  const setVariantInfo = (code: string, info: Partial<CustomerClassificationInfo>) => {
    const variants = getVariants(code);
    for (const v of variants) {
      const existing = map.get(v) || { classification: info.classification || info.dairyClassification || 'C' };
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
            const dairy = item.dairyClassification && item.dairyClassification !== '-' ? item.dairyClassification : undefined;
            const ice = item.iceCreamClassification && item.iceCreamClassification !== '-' ? item.iceCreamClassification : undefined;
            const cls = (dairy || item.classification || ice || 'C').trim().toUpperCase();
            const ch = item.channel ? String(item.channel).trim().toUpperCase() : undefined;
            
            setVariantInfo(item.customerCode, {
              classification: cls && cls !== '-' ? cls : 'C',
              dairyClassification: dairy,
              iceCreamClassification: ice,
              channel: ch,
            });

            if (item.customerName) {
              const cleanName = String(item.customerName).toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (cleanName) {
                setVariantInfo(`NAME:${cleanName}`, {
                  classification: cls && cls !== '-' ? cls : 'C',
                  dairyClassification: dairy,
                  iceCreamClassification: ice,
                  channel: ch,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error reading customers.json for classification mapping:', e);
    }
  }

  // 2. Load from classification excel files if present
  const candidateClassFiles: string[] = [
    path.join(process.cwd(), 'data', 'Customer_Classification.xlsx'),
    path.join(process.cwd(), 'data', 'Customer_Classification_DUMMY.xlsx'),
    path.join(process.cwd(), 'data', 'Master_Classification.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Customer_Classification.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Customer_Classification_DUMMY.xlsx'),
    path.join(process.cwd(), 'public', 'uploads', 'Master_Classification.xlsx'),
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/SALES DATA/SALES BINDER & MASTERS/MASTER FILES/Customer_Classification.xlsx',
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/SALES DATA/SALES BINDER & MASTERS/MASTER FILES/Master_Classification.xlsx',
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/Customer_Classification.xlsx',
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/Master_Classification.xlsx',
  ];

  const searchDirs = [
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'public', 'uploads'),
    'd:/OneDrive - Dandy Company Ltd/D- One Drive/SALES DATA/SALES BINDER & MASTERS/MASTER FILES',
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
            const code = getRowVal(row, 'Customer Code', 'CustomerCode', 'customercode', 'Code');
            const name = getRowVal(row, 'Customer Name', 'CustomerName', 'name');
            const cls = getRowVal(row, 'Classification', 'Class', 'Grade');
            const vert = getRowVal(row, 'Business vertical', 'Business Vertical', 'Vertical', 'businessVertical');
            const ch = getRowVal(row, 'Channel', 'CHANNEL');

            if (code && cls) {
              const codeStr = String(code).trim().toUpperCase();
              const clsStr = String(cls).trim().toUpperCase();
              const vertStr = String(vert || '').trim().toLowerCase();
              const chStr = ch ? String(ch).trim().toUpperCase() : undefined;

              const isIce = vertStr.includes('ice');
              const isDairy = vertStr.includes('dairy') || (!vertStr.includes('ice') && !vertStr.includes('dairy'));

              const info: Partial<CustomerClassificationInfo> = {
                classification: clsStr !== '-' ? clsStr : undefined,
                dairyClassification: isDairy && clsStr !== '-' ? clsStr : undefined,
                iceCreamClassification: isIce && clsStr !== '-' ? clsStr : undefined,
                channel: chStr,
              };

              setVariantInfo(codeStr, info);

              if (name) {
                const cleanName = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (cleanName) {
                  setVariantInfo(`NAME:${cleanName}`, info);
                }
              }
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
  const rtmSet = new Set<string>();
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
          
          let segFin =
            r['Segment_Fin(120MT)'] ||
            r['Segment_Fin'] ||
            r['Segment Fin'] ||
            r['segment_fin(120mt)'] ||
            r['segment fin 120'] ||
            r['CHANNEL'] ||
            '';
          if (!segFin) {
            const matchingKey = Object.keys(r).find((k) => {
              const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return lower.includes('segmentfin') || (lower.includes('segment') && lower.includes('fin')) || lower.includes('120mt');
            });
            if (matchingKey) segFin = r[matchingKey];
          }
          const channelRaw = String(segFin || 'GT').trim().toUpperCase();
          if (channelRaw && channelRaw !== 'GENERAL TRADE' && channelRaw !== 'GENERAL STORE' && channelRaw !== 'GT') {
            rtmSet.add(channelRaw);
          }

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
          if (!clsInfo && custName) {
            const cleanName = custName.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (cleanName) {
              clsInfo = classMap.get(`NAME:${cleanName}`);
            }
          }

          const dairyCls = clsInfo?.dairyClassification;
          const iceCls = clsInfo?.iceCreamClassification;
          // In dairy-focused operations, dairy classification from master classification file is primary
          let cls = (dairyCls && dairyCls !== '-')
            ? dairyCls
            : (clsInfo?.classification && clsInfo.classification !== '-'
                ? clsInfo.classification
                : (iceCls && iceCls !== '-' ? iceCls : 'C'));
          if (!cls || cls === '-') cls = 'C';
          classificationSet.add(cls);
          customerClassificationMap[custCodeRaw] = cls;

          let finalChannel = channelRaw;
          if (!finalChannel || finalChannel === 'GENERAL TRADE' || finalChannel === 'GENERAL STORE' || finalChannel === 'GT') {
            if (clsInfo?.channel && clsInfo.channel !== 'GT' && clsInfo.channel !== 'GENERAL TRADE') {
              finalChannel = clsInfo.channel;
            } else if (rtRaw.startsWith('MT')) {
              finalChannel = 'MT';
            } else if (rtRaw.startsWith('IS')) {
              finalChannel = 'INST';
            } else if (rtRaw.startsWith('TR')) {
              finalChannel = 'TT';
            } else if (validManager === 'ADNAN' || ['ASAD', 'SAIFULLAH', 'KISHAN', 'JAVED', 'MOHSIN', 'RASHWIN'].includes(validSupervisor)) {
              finalChannel = 'MT';
            } else {
              finalChannel = 'TT';
            }
          }
          if (!finalChannel || finalChannel === 'GT') finalChannel = rtRaw.startsWith('MT') ? 'MT' : 'TT';

          if (custCodeRaw) {
            customerList.push({
              customerCode: custCodeRaw,
              customerName: custName,
              routeCode: rtRaw,
              cust_rt_id: r['Cust_Rt_ID'] || `${custCodeRaw}|${rtRaw}`,
              managerName: validManager,
              superName: validSupervisor,
              classification: cls,
              dairyClassification: dairyCls || cls,
              iceCreamClassification: iceCls || undefined,
              channel: finalChannel,
              rtm: finalChannel,
            });
          }
        }
        // Ensure MTI and known Modern Trade routes under Adnan are present
        const knownExtraRoutes: Record<string, string> = {
          MTI401: 'MOHSIN',
          MTI402: 'ASAD',
          MTI403: 'SAIFULLAH',
          MTI404: 'KISHAN',
          MTI405: 'JAVED',
          MTI406: 'RASHWIN',
          MTD216: 'ASAD',
        };
        Object.entries(knownExtraRoutes).forEach(([rtCode, sup]) => {
          if (!routeMap.has(rtCode)) {
            routeMap.set(rtCode, {
              routeCode: rtCode,
              routeName: `Route ${rtCode}`,
              managerName: 'ADNAN',
              superName: sup,
            });
            routeManagerMap[rtCode] = 'ADNAN';
            routeSupervisorMap[rtCode] = sup;
            if (!supervisorRoutesMap[sup]) supervisorRoutesMap[sup] = [];
            if (!supervisorRoutesMap[sup].includes(rtCode)) supervisorRoutesMap[sup].push(rtCode);
            if (!managerRoutesMap['ADNAN']) managerRoutesMap['ADNAN'] = [];
            if (!managerRoutesMap['ADNAN'].includes(rtCode)) managerRoutesMap['ADNAN'].push(rtCode);
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

  // Strictly partition routes between SAIFULLAH (Modern Trade only) and SAIF (Traditional Trade only)
  if (supervisorRoutesMap['SAIFULLAH']) {
    supervisorRoutesMap['SAIFULLAH'] = supervisorRoutesMap['SAIFULLAH'].filter((r) => !r.startsWith('TR'));
  }
  if (supervisorRoutesMap['SAIF']) {
    supervisorRoutesMap['SAIF'] = supervisorRoutesMap['SAIF'].filter((r) => !r.startsWith('MT'));
  }

  // Sort maps
  Object.keys(managerSupervisorMap).forEach((m) => managerSupervisorMap[m].sort());
  Object.keys(managerRoutesMap).forEach((m) => managerRoutesMap[m].sort());
  Object.keys(supervisorRoutesMap).forEach((s) => supervisorRoutesMap[s].sort());

  const managers = Array.from(managerSet).sort();
  const supervisors = Array.from(supervisorSet).sort();
  const classifications = Array.from(classificationSet).sort();
  const routes = Array.from(routeMap.values()).sort((a, b) => a.routeCode.localeCompare(b.routeCode));
  const rtms = rtmSet.size > 0 ? Array.from(rtmSet).sort() : ['INST', 'MT', 'TT'];

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
    rtms,
  };

  lastCacheTime = now;
  return cachedCustMaster;
}
