import * as XLSX from 'xlsx';

export interface ExcelColumn<T = any> {
  header: string;
  key: keyof T | string;
  formatter?: (val: any, row: T) => string | number;
}

export interface ExportToExcelOptions<T = any> {
  filename: string;
  sheetName?: string;
  title?: string;
  filterSummary?: string;
  userRole?: string;
  columns: ExcelColumn<T>[];
  data: T[];
}

/**
 * Generic Excel Exporter that builds a clean spreadsheet starting with column headers.
 */
export function exportToExcel<T = any>({
  filename,
  sheetName = 'Sheet1',
  columns,
  data,
}: ExportToExcelOptions<T>) {
  const sheetRows: any[][] = [];

  // Header Row
  sheetRows.push(columns.map((c) => c.header));

  // Data Rows
  if (data && data.length > 0) {
    data.forEach((row) => {
      const rowValues = columns.map((col) => {
        const rawVal = (row as any)[col.key];
        if (col.formatter) {
          return col.formatter(rawVal, row);
        }
        if (rawVal === null || rawVal === undefined) return '—';
        if (typeof rawVal === 'boolean') return rawVal ? 'YES' : 'NO';
        if (rawVal instanceof Date) return rawVal.toLocaleString();
        return rawVal;
      });
      sheetRows.push(rowValues);
    });
  } else {
    sheetRows.push(['No matching data records found.']);
  }

  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);

  // Set column widths based on max content length
  const colWidths = columns.map((col, colIdx) => {
    let maxLen = col.header.length;
    sheetRows.slice(1).forEach((r) => {
      const val = r[colIdx];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  sheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.substring(0, 31));

  const cleanFilename = filename.toLowerCase().endsWith('.xlsx')
    ? filename
    : `${filename.replace(/[^a-z0-9_-]+/gi, '_')}.xlsx`;

  XLSX.writeFile(workbook, cleanFilename);
}
