/**
 * Utility to export Asset Branding Requests with photos to:
 * 1. Excel (.xlsx) with embedded high-resolution photo thumbnails using ExcelJS.
 * 2. PowerPoint (.pptx) executive widescreen presentation slides using PptxGenJS.
 */

import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import { AssetBrandingRequest } from '@/lib/asset-branding';

export interface BrandingExportOptions {
  filename?: string;
  filterSummary?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Fetch an image URL and convert it to a sanitized base64 string suitable for ExcelJS and PptxGenJS.
 * Normalizes all image types (including WebP, PNG, etc.) to JPEG or PNG.
 */
export async function urlToBase64(
  url: string,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.8
): Promise<{ base64: string; extension: 'jpeg' | 'png' } | null> {
  if (!url) return null;

  try {
    // If already data URI
    if (url.startsWith('data:image/')) {
      const match = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        const rawExt = match[1].toLowerCase();
        const base64Data = match[2];
        const ext = rawExt.includes('png') ? 'png' : 'jpeg';
        return { base64: base64Data, extension: ext };
      }
    }

    // Resolve relative URL if needed
    let resolvedUrl = url;
    if (typeof window !== 'undefined' && url.startsWith('/')) {
      resolvedUrl = `${window.location.origin}${url}`;
    }

    // If running in browser, load into Image element & render to Canvas for cross-format consistency & compression
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const timer = setTimeout(() => {
          resolve(null);
        }, 12000); // 12s timeout

        img.onload = () => {
          clearTimeout(timer);
          try {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(width, 1);
            canvas.height = Math.max(height, 1);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataUrl.split(',')[1];
            resolve({ base64, extension: 'jpeg' });
          } catch {
            resolve(null);
          }
        };

        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };

        img.src = resolvedUrl;
      });
    }

    // Fallback via fetch
    const res = await fetch(resolvedUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    return { base64, extension: 'jpeg' };
  } catch (err) {
    console.warn('Failed to load image for export:', url, err);
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
    { key: 'assetModel', width: 22 },
    { key: 'photo', width: 28 }, // Photo Column (Width ~ 180px, Col I)
    { key: 'notes', width: 34 },
    { key: 'createdAt', width: 20 },
    { key: 'status', width: 20 },
    { key: 'acknowledgedByName', width: 20 },
    { key: 'acknowledgedAt', width: 20 },
    { key: 'decision', width: 18 },
    { key: 'adminComment', width: 36 },
  ];

  // Title Banner
  const titleRow = worksheet.addRow(['DANDY FIELD VISIT SYSTEM - ASSET BRANDING REQUESTS REPORT']);
  titleRow.height = 30;
  worksheet.mergeCells('A1:P1');
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Slate
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle / Filter Info
  const subRow = worksheet.addRow([
    options.filterSummary || `Generated on: ${new Date().toLocaleString()} | Total Records: ${requests.length}`,
  ]);
  subRow.height = 20;
  worksheet.mergeCells('A2:P2');
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
    'Asset Model / Size',
    'Asset Condition Photo',
    'Supervisor Notes',
    'Requested Date',
    'Status',
    'Acknowledged By',
    'Acknowledged Date',
    'Admin Decision',
    'Admin Remarks / Reason',
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
    const decisionVal = req.decision || (req.status === 'Approved' ? 'Approved' : req.status === 'Rejected' ? 'Rejected' : isPending ? 'Pending' : 'Under Review');
    const assetModelVal = [req.assetType, req.assetModel || req.sizeModel].filter(Boolean).join(' - ') || '—';

    const rowData = [
      req.requestNumber,
      req.outletName,
      req.outletCode,
      req.routeCode,
      req.classification ? `Class ${req.classification}` : 'Class C',
      req.channel || 'GT',
      req.supervisorName,
      assetModelVal,
      '', // Placeholder for photo in Column I (Index 9 / Column 8 in 0-indexed)
      req.notes || req.brandingScope || '—',
      new Date(req.createdAt).toLocaleString(),
      req.status,
      req.acknowledgedByName || (isPending ? 'Awaiting Admin' : '—'),
      req.acknowledgedAt ? new Date(req.acknowledgedAt).toLocaleString() : '—',
      decisionVal,
      req.adminComment || '—',
    ];

    const row = worksheet.addRow(rowData);
    row.height = 95; // Ample row height for crisp photo thumbnail

    // Cell Styling
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9.5 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 || colNumber === 10 || colNumber === 16 ? 'left' : 'center', wrapText: true };
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

      // Status coloring (Col L / 12)
      if (colNumber === 12) {
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: true,
          color: {
            argb: req.status === 'Approved' ? 'FF16A34A' : req.status === 'Rejected' ? 'FFE11D48' : isPending ? 'FFD97706' : 'FF059669',
          },
        };
      }

      // Decision coloring (Col O / 15)
      if (colNumber === 15) {
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: true,
          color: {
            argb: decisionVal === 'Approved' ? 'FF16A34A' : decisionVal === 'Rejected' ? 'FFE11D48' : 'FF64748B',
          },
        };
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

          // Place inside Column I (Column Index 8 in 0-based), Row currentRowIndex
          worksheet.addImage(imageId, {
            tl: { col: 8.15, row: currentRowIndex - 0.92 },
            ext: { width: 140, height: 110 },
            editAs: 'oneCell',
          });
        }
      } catch (err) {
        console.warn('Failed to embed photo in row:', currentRowIndex, err);
      }
    } else {
      const cellI = worksheet.getCell(`I${currentRowIndex}`);
      cellI.value = 'No Photo Attached';
      cellI.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
      cellI.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    currentRowIndex++;
  }

  if (onProgress) onProgress(total, total, 'Packaging and downloading Excel workbook...');

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename);
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
  const approvedCount = requests.filter((r) => r.decision === 'Approved' || r.status === 'Approved').length;
  const rejectedCount = requests.filter((r) => r.decision === 'Rejected' || r.status === 'Rejected').length;

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
    'Field inspection audit photos, asset branding condition requests, administrative acknowledgement, and approval/rejection decisions.',
    {
      x: 1.2,
      y: 2.8,
      fontSize: 14,
      color: '94A3B8',
      fontFace: 'Segoe UI',
      w: 10,
    }
  );

  // Summary Metrics Banner on Title Slide (4 KPI cards)
  const kpiCards = [
    { label: 'TOTAL REQUESTS', val: String(total), color: '94A3B8', valColor: 'FFFFFF', borderColor: '334155' },
    { label: 'PENDING', val: String(pendingCount), color: 'F59E0B', valColor: 'F59E0B', borderColor: 'F59E0B' },
    { label: 'ACKNOWLEDGED', val: String(ackCount), color: '10B981', valColor: '10B981', borderColor: '10B981' },
    { label: 'APPROVED / REJECTED', val: `${approvedCount} / ${rejectedCount}`, color: '38BDF8', valColor: '38BDF8', borderColor: '0284C7' },
  ];

  kpiCards.forEach((kpi, idx) => {
    const cardX = 1.2 + idx * 2.8;
    titleSlide.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: 4.0,
      w: 2.6,
      h: 1.5,
      fill: { color: '1E293B' },
      line: { color: kpi.borderColor, width: 1 },
      rectRadius: 0.1,
    });
    titleSlide.addText(kpi.label, {
      x: cardX + 0.15,
      y: 4.2,
      fontSize: 9,
      bold: true,
      color: kpi.color,
      fontFace: 'Segoe UI',
    });
    titleSlide.addText(kpi.val, {
      x: cardX + 0.15,
      y: 4.5,
      fontSize: 24,
      bold: true,
      color: kpi.valColor,
      fontFace: 'Segoe UI',
    });
  });

  titleSlide.addText(`Generated: ${new Date().toLocaleString()}  •  Confidential  •  Dandy Company`, {
    x: 1.2,
    y: 6.2,
    fontSize: 10,
    color: '64748B',
    fontFace: 'Segoe UI',
  });

  // ==========================================
  // SLIDES 2..N: 1 Slide per Branding Request
  // ==========================================
  for (let idx = 0; idx < total; idx++) {
    const req = requests[idx];
    if (onProgress) {
      onProgress(idx + 1, total, `Building PowerPoint Slide ${idx + 2} of ${total + 1} (${req.requestNumber})...`);
    }

    const isPending = req.status === 'Pending Acknowledgement';
    const isApproved = req.decision === 'Approved' || req.status === 'Approved';
    const isRejected = req.decision === 'Rejected' || req.status === 'Rejected';

    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' }; // Soft Off-White

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
    const statusText = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : isPending ? 'PENDING' : 'ACKNOWLEDGED';
    const statusBg = isApproved ? '14532D' : isRejected ? '881337' : isPending ? '78350F' : '064E3B';
    const statusBorder = isApproved ? '22C55E' : isRejected ? 'F43F5E' : isPending ? 'F59E0B' : '10B981';
    const statusColor = isApproved ? 'DCFCE7' : isRejected ? 'FFE4E6' : isPending ? 'FDE68A' : 'A7F3D0';

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 10.4,
      y: 0.25,
      w: 2.4,
      h: 0.5,
      fill: { color: statusBg },
      line: { color: statusBorder, width: 1.5 },
      rectRadius: 0.25,
    });
    slide.addText(statusText, {
      x: 10.4,
      y: 0.25,
      w: 2.4,
      h: 0.5,
      fontSize: 10,
      bold: true,
      color: statusColor,
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

    let photoLoaded = false;
    if (req.photoUrl) {
      try {
        const photoData = await urlToBase64(req.photoUrl, 1200, 900, 0.85);
        if (photoData) {
          slide.addImage({
            data: `data:image/${photoData.extension};base64,${photoData.base64}`,
            x: 0.75,
            y: 1.45,
            w: 6.1,
            h: 4.5,
            sizing: { type: 'contain', w: 6.1, h: 4.5 },
          });
          photoLoaded = true;
        }
      } catch (err) {
        console.warn('Failed to load image into pptx slide:', err);
      }
    }

    if (!photoLoaded) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 1.2,
        y: 2.2,
        w: 5.2,
        h: 3.2,
        fill: { color: 'F1F5F9' },
        line: { color: 'E2E8F0', width: 1, dashType: 'dash' },
        rectRadius: 0.1,
      });
      slide.addText('NO CONDITION PHOTO ATTACHED', {
        x: 1.2,
        y: 3.5,
        w: 5.2,
        h: 0.5,
        fontSize: 12,
        bold: true,
        color: '94A3B8',
        fontFace: 'Segoe UI',
        align: 'center',
      });
    }

    // Photo Caption Bar at bottom of photo card
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 6.0,
      w: 6.4,
      h: 0.7,
      fill: { color: '0F172A' },
      rectRadius: 0,
    });
    slide.addText(
      `Photo captured by ${req.supervisorName}  •  ${new Date(req.createdAt).toLocaleString()}`,
      {
        x: 0.8,
        y: 6.1,
        w: 6.0,
        fontSize: 10,
        color: 'E2E8F0',
        fontFace: 'Segoe UI',
      }
    );

    // -------------------------------------------------------------------------
    // RIGHT SIDE: Shop Details, Supervisor Notes & Admin Decision Cards
    // -------------------------------------------------------------------------
    // Card 1: Shop & Outlet Summary
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 1.3,
      w: 5.5,
      h: 2.15,
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
        { text: 'Asset Model / Size: ', options: { bold: true, color: '64748B' } },
        { text: [req.assetType, req.assetModel || req.sizeModel].filter(Boolean).join(' - ') || 'N/A', options: { bold: true, color: '0284C7' } },
      ],
      [
        { text: 'Channel / RTM: ', options: { bold: true, color: '64748B' } },
        { text: req.channel || 'GT', options: { color: '0F172A' } },
      ],
    ];

    let startY = 1.68;
    infoRows.forEach((r) => {
      slide.addText(r, {
        x: 7.5,
        y: startY,
        w: 5.1,
        fontSize: 9.5,
        fontFace: 'Segoe UI',
      });
      startY += 0.23;
    });

    // Card 2: Supervisor Notes & Reason for Branding
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 3.55,
      w: 5.5,
      h: 1.5,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', width: 1 },
      rectRadius: 0.15,
    });

    slide.addText('SUPERVISOR OBSERVATIONS & NOTES', {
      x: 7.5,
      y: 3.7,
      fontSize: 11,
      bold: true,
      color: '0F172A',
      fontFace: 'Segoe UI',
    });

    slide.addText(`"${req.notes || req.brandingScope || 'Asset branding required'}"`, {
      x: 7.5,
      y: 4.0,
      w: 5.1,
      h: 0.55,
      fontSize: 10,
      italic: true,
      color: '334155',
      fontFace: 'Segoe UI',
    });

    slide.addText(`Reported By: ${req.supervisorName} on ${new Date(req.createdAt).toLocaleDateString()}`, {
      x: 7.5,
      y: 4.65,
      w: 5.1,
      fontSize: 8.5,
      color: '64748B',
      fontFace: 'Segoe UI',
    });

    // Card 3: Administrative Acknowledgement & Decision
    const decisionCardBg = isApproved ? 'DCFCE7' : isRejected ? 'FEE2E2' : isPending ? 'FEF3C7' : 'D1FAE5';
    const decisionCardBorder = isApproved ? '16A34A' : isRejected ? 'E11D48' : isPending ? 'F59E0B' : '10B981';
    const decisionCardHeaderColor = isApproved ? '166534' : isRejected ? '991B1B' : isPending ? '92400E' : '065F46';

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 7.3,
      y: 5.2,
      w: 5.5,
      h: 1.5,
      fill: { color: decisionCardBg },
      line: { color: decisionCardBorder, width: 1 },
      rectRadius: 0.15,
    });

    slide.addText(
      isApproved
        ? 'MANAGEMENT DECISION: APPROVED'
        : isRejected
        ? 'MANAGEMENT DECISION: REJECTED'
        : 'ADMINISTRATIVE ACKNOWLEDGEMENT',
      {
        x: 7.5,
        y: 5.35,
        fontSize: 10.5,
        bold: true,
        color: decisionCardHeaderColor,
        fontFace: 'Segoe UI',
      }
    );

    if (isPending) {
      slide.addText('Status: Pending Administrative Review & Acknowledgement', {
        x: 7.5,
        y: 5.7,
        w: 5.1,
        fontSize: 9.5,
        bold: true,
        color: 'B45309',
        fontFace: 'Segoe UI',
      });
    } else if (isApproved || isRejected) {
      slide.addText(
        `Decided by: ${req.decisionByName || req.acknowledgedByName || 'Admin'}  •  ${
          req.decisionAt || req.acknowledgedAt ? new Date(req.decisionAt || req.acknowledgedAt!).toLocaleDateString() : '—'
        }`,
        {
          x: 7.5,
          y: 5.65,
          w: 5.1,
          fontSize: 9,
          bold: true,
          color: isApproved ? '14532D' : '7F1D1D',
          fontFace: 'Segoe UI',
        }
      );
      slide.addText(`Remarks: "${req.adminComment || 'No additional remarks'}"`, {
        x: 7.5,
        y: 5.95,
        w: 5.1,
        h: 0.6,
        fontSize: 9,
        italic: true,
        color: isApproved ? '166534' : '991B1B',
        fontFace: 'Segoe UI',
      });
    } else {
      slide.addText(
        `Acknowledged by: ${req.acknowledgedByName || 'Admin'} on ${
          req.acknowledgedAt ? new Date(req.acknowledgedAt).toLocaleString() : '—'
        }`,
        {
          x: 7.5,
          y: 5.7,
          w: 5.1,
          fontSize: 9.5,
          bold: true,
          color: '047857',
          fontFace: 'Segoe UI',
        }
      );
      if (req.adminComment) {
        slide.addText(`Remarks: "${req.adminComment}"`, {
          x: 7.5,
          y: 6.05,
          w: 5.1,
          fontSize: 9,
          italic: true,
          color: '065F46',
          fontFace: 'Segoe UI',
        });
      }
    }

    // Slide Footer
    slide.addText(`Slide ${idx + 2} of ${total + 1}  •  Dandy Field Visit System  •  ${req.requestNumber}`, {
      x: 0.6,
      y: 7.1,
      w: 12.13,
      fontSize: 8.5,
      color: '94A3B8',
      fontFace: 'Segoe UI',
    });
  }

  if (onProgress) onProgress(total, total, 'Generating PowerPoint file...');

  await pptx.writeFile({ fileName: filename });
}
