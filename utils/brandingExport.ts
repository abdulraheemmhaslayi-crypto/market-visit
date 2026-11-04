import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import { AssetBrandingRequest } from '@/lib/asset-branding';

export interface BrandingExportOptions {
  filename?: string;
  title?: string;
  filterSummary?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Fallback to direct fetch + FileReader if canvas cannot load image
 */
async function fallbackFetch(
  url: string,
  resolve: (val: { base64: string; extension: 'jpeg' | 'png' } | null) => void
) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      resolve(null);
      return;
    }
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const b64 = result.replace(/^data:image\/\w+;base64,/, '');
      resolve({ base64: b64, extension: 'jpeg' });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  } catch {
    resolve(null);
  }
}

/**
 * Converts any image URL (data URI, relative path, or remote URL) to standard JPEG/PNG base64.
 */
async function urlToBase64(url: string): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  try {
    if (!url || typeof url !== 'string') return null;

    let fullUrl = url;
    if (typeof window !== 'undefined' && !url.startsWith('http') && !url.startsWith('data:')) {
      fullUrl = window.location.origin + (url.startsWith('/') ? url : `/${url}`);
    }

    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        fallbackFetch(fullUrl, resolve);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            fallbackFetch(fullUrl, resolve);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          resolve({ base64: b64, extension: 'jpeg' });
        } catch {
          fallbackFetch(fullUrl, resolve);
        }
      };
      img.onerror = () => {
        fallbackFetch(fullUrl, resolve);
      };
      img.src = fullUrl;
    });
  } catch (err) {
    console.warn('Failed to convert image for export:', url, err);
    return null;
  }
}

/**
 * Trigger browser file download from Blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export Asset Branding Requests to Excel (.xlsx) with EMBEDDED PHOTOS
 */
export async function exportBrandingToExcelWithPhotos(
  requests: AssetBrandingRequest[],
  options: BrandingExportOptions = {}
): Promise<void> {
  const filename = options.filename || `Asset_Branding_Requests_With_Photos_${new Date().toISOString().split('T')[0]}.xlsx`;
  const onProgress = options.onProgress;

  if (onProgress) onProgress(0, requests.length, 'Initializing Excel Workbook...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dandy Field Visit System';
  workbook.lastModifiedBy = 'Dandy Supervisor App';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Asset Branding Requests', {
    views: [{ showGridLines: true }],
  });

  // Setup Column Definitions
  worksheet.columns = [
    { key: 'requestNumber', width: 14 },
    { key: 'outletName', width: 28 },
    { key: 'outletCode', width: 14 },
    { key: 'routeCode', width: 12 },
    { key: 'classification', width: 12 },
    { key: 'channel', width: 10 },
    { key: 'supervisorName', width: 20 },
    { key: 'photo', width: 28 }, // Photo Column (Width ~ 180px)
    { key: 'notes', width: 34 },
    { key: 'createdAt', width: 20 },
    { key: 'status', width: 20 },
    { key: 'acknowledgedByName', width: 20 },
    { key: 'acknowledgedAt', width: 20 },
  ];

  // Title Banner
  const titleRow = worksheet.addRow(['DANDY FIELD VISIT SYSTEM - ASSET BRANDING REQUESTS REPORT']);
  titleRow.height = 30;
  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Slate
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle / Filter Info
  const subRow = worksheet.addRow([
    options.filterSummary || `Generated on: ${new Date().toLocaleString()} | Total Records: ${requests.length}`,
  ]);
  subRow.height = 20;
  worksheet.mergeCells('A2:M2');
  const subCell = worksheet.getCell('A2');
  subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Empty Spacer Row
  worksheet.addRow([]);

  // Header Row (Row 4)
  const headerValues = [
    'Request ID',
    'Outlet Name',
    'Outlet Code',
    'Route',
    'Class',
    'Channel',
    'Supervisor',
    'Asset Condition Photo',
    'Supervisor Notes',
    'Requested Date',
    'Status',
    'Acknowledged By',
    'Acknowledged Date',
  ];
  const headerRow = worksheet.addRow(headerValues);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Dandy Navy Blue
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Data Rows with Images
  let currentRowIndex = 5;
  const total = requests.length;

  for (let i = 0; i < total; i++) {
    const req = requests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Processing record ${i + 1} of ${total} (${req.requestNumber})...`);
    }

    const isPending = req.status === 'Pending Acknowledgement';

    const rowData = [
      req.requestNumber,
      req.outletName,
      req.outletCode,
      req.routeCode,
      req.classification ? `Class ${req.classification}` : 'Class C',
      req.channel || 'GT',
      req.supervisorName,
      '', // Placeholder for photo in Column H (Index 8 / Column 7 in 0-indexed)
      req.notes || req.brandingScope || '—',
      new Date(req.createdAt).toLocaleString(),
      req.status,
      req.acknowledgedByName || (isPending ? 'Awaiting Admin' : '—'),
      req.acknowledgedAt ? new Date(req.acknowledgedAt).toLocaleString() : '—',
    ];

    const row = worksheet.addRow(rowData);
    row.height = 95; // Ample row height for crisp photo thumbnail

    // Cell Styling
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9.5 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 || colNumber === 9 ? 'left' : 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Zebra striping
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Highlight Request ID
      if (colNumber === 1) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF2563EB' } };
      }

      // Status pill coloring
      if (colNumber === 11) {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: isPending ? 'FFD97706' : 'FF059669' } };
      }
    });

    // Embed Asset Photo if available
    if (req.photoUrl) {
      try {
        const photoData = await urlToBase64(req.photoUrl);
        if (photoData) {
          const imageId = workbook.addImage({
            base64: photoData.base64,
            extension: photoData.extension,
          });

          // Place inside Column H (Column Index 7 in 0-based), Row currentRowIndex
          worksheet.addImage(imageId, {
            tl: { col: 7.15, row: currentRowIndex - 1 + 0.08 },
            ext: { width: 155, height: 110 },
            editAs: 'oneCell',
          });
        } else {
          const photoCell = row.getCell(8);
          photoCell.value = 'Photo Unavailable';
          photoCell.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
        }
      } catch (imgErr) {
        console.warn(`Failed to embed photo for ${req.requestNumber}:`, imgErr);
        const photoCell = row.getCell(8);
        photoCell.value = 'Photo Error';
        photoCell.font = { size: 9, italic: true, color: { argb: 'FFEF4444' } };
      }
    } else {
      const photoCell = row.getCell(8);
      photoCell.value = 'No Photo Attached';
      photoCell.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
    }

    currentRowIndex++;
  }

  if (onProgress) onProgress(total, total, 'Generating Excel binary file...');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Export Asset Branding Requests to PowerPoint (.pptx) with PHOTOS & EXECUTIVE SLIDES
 */
export async function exportBrandingToPowerPoint(
  requests: AssetBrandingRequest[],
  options: BrandingExportOptions = {}
): Promise<void> {
  const filename = options.filename || `Asset_Branding_Report_${new Date().toISOString().split('T')[0]}.pptx`;
  const onProgress = options.onProgress;

  if (onProgress) onProgress(0, requests.length, 'Initializing PowerPoint Presentation...');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Dandy Field Visit System';
  pptx.company = 'Dandy Company';
  pptx.title = 'Asset Branding Requirement Report';

  const total = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'Pending Acknowledgement').length;
  const ackCount = requests.filter((r) => r.status === 'Acknowledged').length;

  // ==========================================
  // SLIDE 1: Executive Title Slide
  // ==========================================
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '0F172A' }; // Deep Slate / Navy

  // Brand Accent Bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.8,
    y: 1.0,
    w: 0.15,
    h: 4.8,
    fill: { color: '0284C7' }, // Sky Blue
  });

  titleSlide.addText('DANDY FIELD VISIT SYSTEM', {
    x: 1.2,
    y: 1.2,
    fontSize: 14,
    bold: true,
    color: '38BDF8',
    fontFace: 'Segoe UI',
  });

  titleSlide.addText('Asset Branding Requirement Report', {
    x: 1.2,
    y: 1.8,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
    w: 11,
  });

  titleSlide.addText(
    'Field inspection audit photos, asset branding condition requests, and administrative acknowledgement tracking.',
    {
      x: 1.2,
      y: 2.8,
      fontSize: 14,
      color: '94A3B8',
      fontFace: 'Segoe UI',
      w: 10,
    }
  );

  // Summary Metrics Banner on Title Slide
  titleSlide.addShape(pptx.ShapeType.roundRect, {
    x: 1.2,
    y: 4.0,
    w: 3.2,
    h: 1.5,
    fill: { color: '1E293B' },
    line: { color: '334155', width: 1 },
    rectRadius: 0.1,
  });
  titleSlide.addText('TOTAL REQUESTS', {
    x: 1.4,
    y: 4.2,
    fontSize: 10,
    bold: true,
    color: '94A3B8',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(String(total), {
    x: 1.4,
    y: 4.5,
    fontSize: 28,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Segoe UI',
  });

  titleSlide.addShape(pptx.ShapeType.roundRect, {
    x: 4.7,
    y: 4.0,
    w: 3.2,
    h: 1.5,
    fill: { color: '1E293B' },
    line: { color: 'F59E0B', width: 1 },
    rectRadius: 0.1,
  });
  titleSlide.addText('PENDING ACKNOWLEDGEMENT', {
    x: 4.9,
    y: 4.2,
    fontSize: 10,
    bold: true,
    color: 'F59E0B',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(String(pendingCount), {
    x: 4.9,
    y: 4.5,
    fontSize: 28,
    bold: true,
    color: 'F59E0B',
    fontFace: 'Segoe UI',
  });

  titleSlide.addShape(pptx.ShapeType.roundRect, {
    x: 8.2,
    y: 4.0,
    w: 3.2,
    h: 1.5,
    fill: { color: '1E293B' },
    line: { color: '10B981', width: 1 },
    rectRadius: 0.1,
  });
  titleSlide.addText('ACKNOWLEDGED', {
    x: 8.4,
    y: 4.2,
    fontSize: 10,
    bold: true,
    color: '10B981',
    fontFace: 'Segoe UI',
  });
  titleSlide.addText(String(ackCount), {
    x: 8.4,
    y: 4.5,
    fontSize: 28,
    bold: true,
    color: '10B981',
    fontFace: 'Segoe UI',
  });

  titleSlide.addText(`Report Date: ${new Date().toLocaleDateString()} | Confidential Dandy Management Review`, {
    x: 1.2,
    y: 6.5,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Segoe UI',
  });

  // ==========================================
  // SLIDES 2..N: Individual Request Slides (1 slide per request)
  // ==========================================
  for (let idx = 0; idx < total; idx++) {
    const req = requests[idx];
    if (onProgress) {
      onProgress(idx + 1, total, `Building PowerPoint slide ${idx + 1} of ${total} (${req.requestNumber})...`);
    }

    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };

    const isPending = req.status === 'Pending Acknowledgement';

    // Slide Top Header Bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 1.0,
      fill: { color: '0F172A' },
    });

    // Request ID Badge
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 0.25,
      w: 1.3,
      h: 0.5,
      fill: { color: '2563EB' },
      rectRadius: 0.1,
    });
    slide.addText(req.requestNumber, {
      x: 0.6,
      y: 0.25,
      w: 1.3,
      h: 0.5,
      fontSize: 13,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Segoe UI',
      align: 'center',
      valign: 'middle',
    });

    // Outlet Title
    slide.addText(req.outletName, {
      x: 2.1,
      y: 0.15,
      w: 8.2,
      h: 0.45,
      fontSize: 17,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Segoe UI',
      valign: 'middle',
    });

    slide.addText(
      `Outlet: ${req.outletCode}  |  Route: ${req.routeCode}  |  Class: ${req.classification ? `Class ${req.classification}` : 'Class C'}  |  Channel: ${req.channel || 'GT'}`,
      {
        x: 2.1,
        y: 0.58,
        w: 8.2,
        h: 0.35,
        fontSize: 10,
        color: '94A3B8',
        fontFace: 'Segoe UI',
      }
    );

    // Status Pill in Header
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 10.6,
      y: 0.25,
      w: 2.2,
      h: 0.5,
      fill: { color: isPending ? '78350F' : '064E3B' },
      line: { color: isPending ? 'F59E0B' : '10B981', width: 1.5 },
      rectRadius: 0.25,
    });
    slide.addText(isPending ? 'PENDING' : 'ACKNOWLEDGED', {
      x: 10.6,
      y: 0.25,
      w: 2.2,
      h: 0.5,
      fontSize: 10,
      bold: true,
      color: isPending ? 'FDE68A' : 'A7F3D0',
      fontFace: 'Segoe UI',
      align: 'center',
      valign: 'middle',
    });

    // -------------------------------------------------------------------------
    // LEFT SIDE: Large High-Resolution Asset Condition Photo (x: 0.6, w: 6.4)
    // -------------------------------------------------------------------------
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: 1.3,
      w: 6.4,
      h: 5.4,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.15,
    });

    slide.addText('ASSET CONDITION PHOTO', {
      x: 0.8,
      y: 1.45,
      fontSize: 11,
      bold: true,
      color: '0F172A',
      fontFace: 'Segoe UI',
    });

    let photoAdded = false;
    if (req.photoUrl) {
      try {
        const photoData = await urlToBase64(req.photoUrl);
        if (photoData) {
          slide.addImage({
            data: `data:image/${photoData.extension};base64,${photoData.base64}`,
            x: 0.8,
            y: 1.85,
            w: 6.0,
            h: 4.2,
            sizing: { type: 'contain', w: 6.0, h: 4.2 },
          });
          photoAdded = true;
        }
      } catch (err) {
        console.warn('Could not embed photo in PPT slide:', err);
      }
    }

    if (!photoAdded) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: 1.85,
        w: 6.0,
        h: 4.2,
        fill: { color: 'F1F5F9' },
      });
      slide.addText('No Condition Photo Available', {
        x: 0.8,
        y: 3.6,
        w: 6.0,
        fontSize: 14,
        color: '94A3B8',
        align: 'center',
        fontFace: 'Segoe UI',
      });
    }

    slide.addText(
      `Photo Proof Captured on: ${new Date(req.createdAt).toLocaleString()} by ${req.supervisorName}`,
      {
        x: 0.8,
        y: 6.2,
        w: 6.0,
        fontSize: 9,
        color: '64748B',
        italic: true,
        fontFace: 'Segoe UI',
      }
    );

    // -------------------------------------------------------------------------
    // RIGHT SIDE: Shop Details & Management Directives Card (x: 7.3, w: 5.5)
    // -------------------------------------------------------------------------
    // Card 1: Shop & Outlet Summary
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 1.3,
      w: 5.5,
      h: 2.3,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.15,
    });

    slide.addText('SHOP & OUTLET INFORMATION', {
      x: 7.5,
      y: 1.45,
      fontSize: 11,
      bold: true,
      color: '0F172A',
      fontFace: 'Segoe UI',
    });

    const infoRows = [
      [
        { text: 'Outlet Name: ', options: { bold: true, color: '64748B' } },
        { text: req.outletName, options: { bold: true, color: '0F172A' } },
      ],
      [
        { text: 'Outlet Code: ', options: { bold: true, color: '64748B' } },
        { text: req.outletCode, options: { bold: true, color: '2563EB' } },
      ],
      [
        { text: 'Route Code: ', options: { bold: true, color: '64748B' } },
        { text: req.routeCode, options: { bold: true, color: '0F172A' } },
      ],
      [
        { text: 'Classification: ', options: { bold: true, color: '64748B' } },
        { text: req.classification ? `Class ${req.classification}` : 'Class C', options: { bold: true, color: '7C3AED' } },
      ],
      [
        { text: 'Channel / RTM: ', options: { bold: true, color: '64748B' } },
        { text: req.channel || 'GT', options: { color: '0F172A' } },
      ],
    ];

    let startY = 1.8;
    infoRows.forEach((r) => {
      slide.addText(r, {
        x: 7.5,
        y: startY,
        w: 5.1,
        fontSize: 10,
        fontFace: 'Segoe UI',
      });
      startY += 0.28;
    });

    // Card 2: Supervisor Notes & Reason for Branding
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 3.8,
      w: 5.5,
      h: 1.6,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.15,
    });

    slide.addText('SUPERVISOR OBSERVATIONS & NOTES', {
      x: 7.5,
      y: 3.95,
      fontSize: 11,
      bold: true,
      color: '0F172A',
      fontFace: 'Segoe UI',
    });

    slide.addText(`"${req.notes || req.brandingScope || 'Asset branding required'}"`, {
      x: 7.5,
      y: 4.3,
      w: 5.1,
      h: 0.65,
      fontSize: 10.5,
      italic: true,
      color: '334155',
      fontFace: 'Segoe UI',
    });

    slide.addText(`Reported By: ${req.supervisorName} on ${new Date(req.createdAt).toLocaleDateString()}`, {
      x: 7.5,
      y: 5.0,
      w: 5.1,
      fontSize: 9,
      color: '64748B',
      fontFace: 'Segoe UI',
    });

    // Card 3: Administrative Acknowledgement
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 5.6,
      w: 5.5,
      h: 1.1,
      fill: { color: isPending ? 'FEF3C7' : 'D1FAE5' },
      line: { color: isPending ? 'F59E0B' : '10B981', width: 1 },
      rectRadius: 0.15,
    });

    slide.addText('ADMINISTRATIVE ACKNOWLEDGEMENT', {
      x: 7.5,
      y: 5.72,
      fontSize: 10,
      bold: true,
      color: isPending ? '92400E' : '065F46',
      fontFace: 'Segoe UI',
    });

    if (isPending) {
      slide.addText('Status: Pending Administrative Review & Acknowledgement', {
        x: 7.5,
        y: 6.05,
        w: 5.1,
        fontSize: 10,
        bold: true,
        color: 'B45309',
        fontFace: 'Segoe UI',
      });
    } else {
      slide.addText(
        `Acknowledged by: ${req.acknowledgedByName || 'Admin'} on ${
          req.acknowledgedAt ? new Date(req.acknowledgedAt).toLocaleString() : '—'
        }`,
        {
          x: 7.5,
          y: 6.05,
          w: 5.1,
          fontSize: 10,
          bold: true,
          color: '047857',
          fontFace: 'Segoe UI',
        }
      );
    }

    // Slide Footer
    slide.addText(`Slide ${idx + 2} of ${total + 1}  •  Dandy Field Visit System  •  ${req.requestNumber}`, {
      x: 0.6,
      y: 7.0,
      w: 12.13,
      fontSize: 8.5,
      color: '94A3B8',
      fontFace: 'Segoe UI',
      align: 'right',
    });
  }

  if (onProgress) onProgress(total, total, 'Writing PowerPoint presentation...');

  await pptx.writeFile({ fileName: filename.endsWith('.pptx') ? filename : `${filename}.pptx` });
}
