import fs from 'fs';
import path from 'path';
import * as xlsx from 'xlsx';

let channelCache: Map<string, string> | null = null;

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

function getVariants(code: string): string[] {
  const clean = normalizeCode(code);
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

export function initCustMasterChannels(): Map<string, string> {
  if (channelCache) return channelCache;

  const map = new Map<string, string>();

  // 1. First seed from data/customers.json if available
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'customers.json');
    if (fs.existsSync(jsonPath)) {
      const list = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          const rawCh = String(item.channel || '').trim().toUpperCase();
          if (rawCh && rawCh !== 'GENERAL TRADE' && rawCh !== 'GENERAL STORE' && rawCh !== 'GT') {
            for (const v of getVariants(item.customerCode)) {
              map.set(v, rawCh);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading data/customers.json for channel fallback:', e);
  }

  // 2. High-priority override from CUSTMASTER.xlsx 'Segment_Fin(120MT)' column
  try {
    const candidatePaths = [
      path.join(process.cwd(), 'data', 'CUSTMASTER.xlsx'),
      path.join(process.cwd(), '..', 'CUSTMASTER.xlsx'),
      'D:/OneDrive - Dandy Company Ltd/D- One Drive/MARKET VISIT- NEW/CUSTMASTER.xlsx',
    ];

    let foundExcelPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundExcelPath = p;
        break;
      }
    }

    if (foundExcelPath) {
      const buf = fs.readFileSync(foundExcelPath);
      const wb = xlsx.read(buf, { type: 'buffer' });
      if (wb.SheetNames.length > 0) {
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet) as any[];

        for (const r of rows) {
          const custCode = r['Customer Code'] || r['customercode'] || r['CustomerCode'];
          // Look for 'Segment_Fin(120MT)' or any segment fin header variant
          let segFin =
            r['Segment_Fin(120MT)'] ||
            r['Segment_Fin'] ||
            r['Segment Fin'] ||
            r['segment_fin(120mt)'] ||
            r['segment fin 120'];

          if (!segFin) {
            // Find key containing segment and (fin or 120)
            const matchingKey = Object.keys(r).find((k) => {
              const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return lower.includes('segmentfin') || (lower.includes('segment') && lower.includes('fin')) || lower.includes('120mt');
            });
            if (matchingKey) {
              segFin = r[matchingKey];
            }
          }

          const channelVal = String(segFin || '').trim().toUpperCase();
          if (custCode && channelVal) {
            for (const v of getVariants(custCode)) {
              map.set(v, channelVal);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading CUSTMASTER.xlsx for channel lookup:', e);
  }

  channelCache = map;
  return channelCache;
}

/**
 * Returns the trade channel for a customer, mapped from CUSTMASTER 'Segment_Fin(120MT)'
 * e.g., 'MT', 'TT', 'INST', 'EXPORT'
 */
export function getCustMasterChannel(customerCode?: string | null, fallback = 'GT'): string {
  if (!customerCode) return fallback;
  const cache = initCustMasterChannels();
  const variants = getVariants(customerCode);
  for (const v of variants) {
    const hit = cache.get(v);
    if (hit) return hit;
  }
  return fallback;
}
