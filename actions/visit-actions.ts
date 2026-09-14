'use server';

import { auth } from '@/lib/auth';
import { visitRepository } from '@/repositories/visit-repository';
import { routeRepository } from '@/repositories/route-repository';
import { customerRepository } from '@/repositories/customer-repository';
import { skuRepository } from '@/repositories/sku-repository';
import { visitSchema, visitDraftSchema, VisitInput, VisitDraftInput } from '@/schemas/visit';
import { auditService } from '@/services/audit-service';
import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';
import { isFullAccessRole, isSupervisorRole, isFleetRole } from '@/lib/roles';

function generateVisitId(): string {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `MV-${YYYY}${MM}${DD}${HH}${mm}${ss}-${rand}`;
}

const getAuthenticatedUser = async () => {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Authentication required');
  }
  const user = session.user as any;
  if (user.status !== 'Active') {
    throw new Error('Your account is inactive.');
  }
  return user;
};

export async function getVisitsAction() {
  const user = await getAuthenticatedUser();
  try {
    let visits: Visit[] = [];
    if (isFullAccessRole(user.role) || isFleetRole(user.role)) {
      visits = await visitRepository.getAllVisits();
    } else if (isSupervisorRole(user.role)) {
      visits = await visitRepository.getVisitsBySupervisor(user.id);
    } else {
      visits = [];
    }

    const enrichedVisits = await Promise.all(
      visits.map(async (v) => {
        const assets = await visitRepository.getVisitAssets(v.visitId);
        const firstAsset = assets[0];
        return {
          ...v,
          temperature: firstAsset ? firstAsset.temperature : 0,
          tempInRange: firstAsset ? firstAsset.tempInRange : true,
          assetType: firstAsset ? firstAsset.assetType : 'Chiller',
        };
      })
    );

    return enrichedVisits;
  } catch (error: any) {
    throw new Error(`Failed to fetch visits: ${error.message}`);
  }
}

export async function getVisitDetailsAction(visitId: string) {
  const user = await getAuthenticatedUser();
  const visit = await visitRepository.getVisitById(visitId);
  if (!visit) {
    throw new Error('Visit record not found');
  }

  if (isSupervisorRole(user.role) && visit.supervisorId !== user.id) {
    throw new Error('Access denied. You do not own this visit record.');
  }

  const photos = await visitRepository.getVisitPhotos(visitId);
  const npdResponses = await visitRepository.getNpdResponses(visitId);
  const assets = await visitRepository.getVisitAssets(visitId);
  const powerSkuResults = await visitRepository.getVisitPowerSkuResults(visitId);

  return { visit, assets, photos, powerSkuResults, npdResponses };
}

export async function saveVisitDraftAction(data: VisitDraftInput) {
  const user = await getAuthenticatedUser();
  const payload = data as any;
  const normalizedData = {
    ...data,
    cust_rt_id: payload.cust_rt_id || (payload.customerCode && payload.routeCode ? `${payload.customerCode}|${payload.routeCode}` : ''),
  };
  const parsed = visitDraftSchema.safeParse(normalizedData);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((e) => e.message).join(', ')}`);
  }

  const input = parsed.data;

  // Generate or convert visitId on the server
  let visitId = input.visitId;
  if (!visitId || !visitId.startsWith('MV-')) {
    visitId = generateVisitId();
  }

  // Verify ownership if editing existing
  const existing = await visitRepository.getVisitById(visitId);
  if (existing) {
    if (user.role === 'Supervisor' && existing.supervisorId !== user.id) {
      throw new Error('Access denied. You cannot modify another supervisor\'s visit.');
    }
    if (existing.status === 'Submitted') {
      throw new Error('Cannot edit a visit that has already been submitted.');
    }
  }

  // Process multiple assets
  const assetRecords: VisitAsset[] = (input.assets || []).map((ast) => {
    let tempInRange = false;
    if (ast.assetType === 'Chiller') {
      tempInRange = ast.temperature !== undefined ? (ast.temperature >= 0 && ast.temperature <= 8) : false;
    } else if (ast.assetType === 'Freezer') {
      tempInRange = ast.temperature !== undefined ? (ast.temperature <= -15) : false;
    }
    return {
      assetId: ast.assetId || 'ast_' + Math.random().toString(36).substring(2, 9),
      visitId,
      assetType: ast.assetType || 'Chiller',
      temperature: ast.temperature || 0,
      tempInRange,
      actionRequired: ast.actionRequired || 'Select Status',
      observation: ast.observation || '',
      isFirstInFlow: ast.isFirstInFlow === true || (ast.isFirstInFlow as any) === 1,
      fefoFollowed: ast.fefoFollowed === true || (ast.fefoFollowed as any) === 1,
    };
  });

  // Convert photos input
  const photoRecords: VisitPhoto[] = (input.photos || []).map((p) => ({
    photoId: p.photoId,
    visitId,
    category: p.category,
    cloudinaryUrl: p.cloudinaryUrl,
    publicId: p.publicId,
    uploadedAt: p.uploadedAt,
  }));

  // Convert Power SKU results
  const powerSkuRecords: VisitPowerSkuResult[] = Object.entries(input.powerSkuResults || {}).map(([skuCode, status]) => ({
    visitId,
    skuCode,
    status: status as any,
  }));

  // Convert NPD responses
  const npdResponses: NPDResponse[] = Object.entries(input.npdResponses || {}).map(([skuCode, status]) => ({
    responseId: `${visitId}_${skuCode}`,
    visitId,
    skuCode,
    status: status as any,
  }));

  const [customerCode, routeCode] = (input.cust_rt_id || '').split('|');

  const visitRecord: Visit = {
    visitId,
    supervisorId: existing?.supervisorId || user.id,
    cust_rt_id: input.cust_rt_id || '',
    visit_type: input.visit_type || 'Visit',
    reason_category: input.reason_category || '',
    reason: input.reason || '',
    observation: input.observation || '',
    latitude: input.latitude || 0,
    longitude: input.longitude || 0,
    accuracy: input.accuracy || 0,
    status: 'Draft',
    createdBy: existing?.createdBy || user.email || '',
    visit_datetime: input.visit_datetime || existing?.visit_datetime || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sosAsPerBda: input.sosAsPerBda === undefined ? null : input.sosAsPerBda,
    routeCode: routeCode || '',
    customerCode: customerCode || '',
    dairyClassification: undefined,
    iceCreamClassification: undefined,
  };

  // Attach customer classifications (dairy / ice-cream) if available
  try {
    const allCustomers = await customerRepository.getAllCustomers();
    const matchedCust = allCustomers.find(c => c.cust_rt_id === visitRecord.cust_rt_id || (c.customerCode === customerCode && c.routeCode === routeCode));
    if (matchedCust) {
      visitRecord.dairyClassification = matchedCust.dairyClassification || undefined;
      visitRecord.iceCreamClassification = matchedCust.iceCreamClassification || undefined;
    }
  } catch (e) {
    // ignore classification enrichment failures
  }

  const savedVisit = await visitRepository.saveVisit(
    visitRecord,
    assetRecords,
    photoRecords,
    powerSkuRecords,
    npdResponses
  );

  await auditService.logAction(
    user.email,
    'Save Visit Draft',
    `Saved draft visit ${visitRecord.visitId} for customer ${customerCode || 'None'}`
  );

  return { success: true, visit: savedVisit };
}

export async function submitVisitAction(data: VisitInput) {
  const user = await getAuthenticatedUser();
  const payload = data as any;
  const normalizedData = {
    ...data,
    cust_rt_id: payload.cust_rt_id || (payload.customerCode && payload.routeCode ? `${payload.customerCode}|${payload.routeCode}` : ''),
  };
  const parsed = visitSchema.safeParse(normalizedData);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((e) => e.message).join(', ')}`);
  }

  const input = parsed.data;



  const [customerCode, routeCode] = input.cust_rt_id.split('|');

  // Enforce route ownership for supervisor only when a route is present
  if (user.role === 'Supervisor' && routeCode) {
    const isAssigned = await routeRepository.isRouteAssignedToSupervisor(routeCode, user.id, user.name);
    if (!isAssigned) {
      throw new Error('Forbidden: Selected Route is not assigned to you.');
    }
  }

  const allCustomers = await customerRepository.getAllCustomers();
  const matchedCust = allCustomers.find(c => c.cust_rt_id === input.cust_rt_id || (c.customerCode === customerCode && c.routeCode === routeCode));

  if (input.visit_type !== 'No Visit') {
    const npdSkus = await skuRepository.getSkusByType('NPD');
    for (const sku of npdSkus) {
      if (!input.npdResponses[sku.skuCode]) {
        input.npdResponses[sku.skuCode] = 'Not Available';
      }
    }

    let channel = matchedCust?.channel || '';
    if (routeCode) {
      try {
        const routes = await routeRepository.getAllRoutes();
        const matchedRoute = routes.find(r => r.routeCode === routeCode);
        if (matchedRoute?.channel) {
          channel = matchedRoute.channel;
        }
      } catch (e) {}
    }

    if (channel) {
      const powerSkus = await skuRepository.getPowerSkusByChannel(channel);
      for (const psku of powerSkus) {
        if (!input.powerSkuResults[psku.skuCode]) {
          input.powerSkuResults[psku.skuCode] = 'Not Available';
        }
      }
    }
  }

  // Generate or convert visitId
  let visitId = input.visitId;
  if (!visitId || !visitId.startsWith('MV-')) {
    visitId = generateVisitId();
  }

  // Verify ownership if editing existing
  const existing = await visitRepository.getVisitById(visitId);
  if (existing) {
    if (user.role === 'Supervisor' && existing.supervisorId !== user.id) {
      throw new Error('Access denied. You cannot modify another supervisor\'s visit.');
    }
  }

  // Process multiple assets (compute tempInRange on server!)
  const assetRecords: VisitAsset[] = input.assets.map((ast) => {
    let tempInRange = false;
    if (ast.assetType === 'Chiller') {
      tempInRange = ast.temperature >= 0 && ast.temperature <= 8;
    } else if (ast.assetType === 'Freezer') {
      tempInRange = ast.temperature <= -15;
    }
    return {
      assetId: ast.assetId,
      visitId,
      assetType: ast.assetType,
      temperature: ast.temperature,
      tempInRange,
      actionRequired: ast.actionRequired || 'Select Status',
      observation: ast.observation || '',
      isFirstInFlow: ast.isFirstInFlow === true || (ast.isFirstInFlow as any) === 1,
      fefoFollowed: ast.fefoFollowed === true || (ast.fefoFollowed as any) === 1,
    };
  });

  const photoRecords: VisitPhoto[] = input.photos.map((p) => ({
    photoId: p.photoId,
    visitId,
    category: p.category,
    cloudinaryUrl: p.cloudinaryUrl,
    publicId: p.publicId,
    uploadedAt: p.uploadedAt,
  }));

  const powerSkuRecords: VisitPowerSkuResult[] = Object.entries(input.powerSkuResults).map(([skuCode, status]) => ({
    visitId,
    skuCode,
    status: status as any,
  }));

  const npdResponses: NPDResponse[] = Object.entries(input.npdResponses).map(([skuCode, status]) => ({
    responseId: `${visitId}_${skuCode}`,
    visitId,
    skuCode,
    status: status as any,
  }));

  const visitRecord: Visit = {
    visitId,
    supervisorId: existing?.supervisorId || user.id,
    cust_rt_id: input.cust_rt_id,
    visit_type: input.visit_type || 'Visit',
    reason_category: input.reason_category || '',
    reason: input.reason || '',
    observation: input.observation || '',
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy || 0,
    status: 'Submitted',
    createdBy: existing?.createdBy || user.email || '',
    visit_datetime: input.visit_datetime || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sosAsPerBda: input.sosAsPerBda === undefined ? null : input.sosAsPerBda,
    routeCode: routeCode || '',
    customerCode: customerCode || '',
    dairyClassification: undefined,
    iceCreamClassification: undefined,
  };

  // Attach customer classifications (dairy / ice-cream) if available
  if (matchedCust) {
    visitRecord.dairyClassification = matchedCust.dairyClassification || undefined;
    visitRecord.iceCreamClassification = matchedCust.iceCreamClassification || undefined;
  }

  const submittedVisit = await visitRepository.saveVisit(
    visitRecord,
    assetRecords,
    photoRecords,
    powerSkuRecords,
    npdResponses
  );

  await auditService.logAction(
    user.email,
    'Submit Visit',
    `Submitted field visit ${visitRecord.visitId} for customer ${customerCode}`
  );

  return { success: true, visit: submittedVisit };
}

export async function deleteVisitAction(visitId: string) {
  const user = await getAuthenticatedUser();
  if (user.role !== 'Admin') {
    throw new Error('Access denied. Administrator privileges required to delete visit logs.');
  }

  const existing = await visitRepository.getVisitById(visitId);
  if (!existing) {
    throw new Error('Visit record not found.');
  }

  await visitRepository.deleteVisit(visitId);

  const [customerCode] = (existing.cust_rt_id || '').split('|');
  await auditService.logAction(
    user.email,
    'Delete Visit',
    `Deleted field visit ${visitId} associated with customer ${customerCode || 'None'}`
  );

  return { success: true };
}
