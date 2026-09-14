import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

// Direct imports using relative paths
import { sharepointUsers } from '../services/sharepoint/users';
import { sharepointRoutes } from '../services/sharepoint/routes';
import { sharepointCustomers } from '../services/sharepoint/customers';
import { sharepointSkus } from '../services/sharepoint/skus';
import { sharepointAudit } from '../services/sharepoint/audit';
import { getListItems } from '../services/sharepoint/client';
import { Visit, VisitPhoto, NPDResponse } from '../types';

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'migration');

const ensureOutputDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
};

const mapFieldsToVisit = (item: any): Visit => {
  const f = item.fields;
  return {
    visitId: f.Title || '',
    supervisorId: f.SupervisorId || '',
    routeCode: f.RouteCode || '',
    customerCode: f.CustomerCode || '',
    assetType: f.AssetType || 'Chiller',
    temperature: typeof f.Temperature === 'number' ? f.Temperature : Number(f.Temperature || 0),
    tempInRange: f.TempInRange === true || f.TempInRange === 'Yes' || f.TempInRange === 'true',
    actionRequired: f.ActionRequired || 'None',
    observation: f.Observation || '',
    latitude: typeof f.Latitude === 'number' ? f.Latitude : Number(f.Latitude || 0),
    longitude: typeof f.Longitude === 'number' ? f.Longitude : Number(f.Longitude || 0),
    accuracy: typeof f.Accuracy === 'number' ? f.Accuracy : Number(f.Accuracy || 0),
    status: f.Status || 'Draft',
    createdBy: f.CreatedBy || '',
    createdAt: f.CreatedAt || item.createdDateTime || new Date().toISOString(),
    updatedAt: f.UpdatedAt || item.lastModifiedDateTime || new Date().toISOString(),
  };
};

const mapFieldsToPhoto = (item: any): VisitPhoto => {
  const f = item.fields;
  return {
    photoId: item.id,
    visitId: f.VisitId || '',
    category: f.Category || 'Assets',
    cloudinaryUrl: f.CloudinaryUrl || '',
    publicId: f.PublicId || '',
    uploadedAt: f.UploadedAt || item.createdDateTime || new Date().toISOString(),
  };
};

const mapFieldsToNpd = (item: any): NPDResponse => {
  const f = item.fields;
  return {
    responseId: item.id,
    visitId: f.VisitId || '',
    skuCode: f.SKUCode || '',
    status: f.Status || 'Not Required',
  };
};

async function runExport() {
  console.log('Starting SharePoint Data Export...');
  ensureOutputDir();

  try {
    // 1. Export Users
    console.log('Exporting Users...');
    const users = await sharepointUsers.getAll();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'users.json'), JSON.stringify(users, null, 2));
    console.log(`Exported ${users.length} users.`);

    // 2. Export Routes
    console.log('Exporting Routes...');
    const routes = await sharepointRoutes.getAll();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2));
    console.log(`Exported ${routes.length} routes.`);

    // 3. Export Customers
    console.log('Exporting Customers...');
    const customers = await sharepointCustomers.getAll();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'customers.json'), JSON.stringify(customers, null, 2));
    console.log(`Exported ${customers.length} customers.`);

    // 4. Export Mappings
    console.log('Exporting Mappings...');
    const mappings = await sharepointCustomers.getMappings();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'mappings.json'), JSON.stringify(mappings, null, 2));
    console.log(`Exported ${mappings.length} customer-route mappings.`);

    // 5. Export SKUs
    console.log('Exporting SKUs...');
    const skus = await sharepointSkus.getAll();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'skus.json'), JSON.stringify(skus, null, 2));
    console.log(`Exported ${skus.length} SKUs.`);

    // 6. Export Visits (main records)
    console.log('Exporting Visits...');
    const visitItems = await getListItems('Visits');
    const visits = visitItems.map(mapFieldsToVisit);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'visits.json'), JSON.stringify(visits, null, 2));
    console.log(`Exported ${visits.length} visit records.`);

    // 7. Export Photos
    console.log('Exporting Photos...');
    const photoItems = await getListItems('VisitPhotos');
    const photos = photoItems.map(mapFieldsToPhoto);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'photos.json'), JSON.stringify(photos, null, 2));
    console.log(`Exported ${photos.length} photo records.`);

    // 8. Export NPD Responses
    console.log('Exporting NPD Responses...');
    const npdItems = await getListItems('NPDResponses');
    const npd = npdItems.map(mapFieldsToNpd);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'npd.json'), JSON.stringify(npd, null, 2));
    console.log(`Exported ${npd.length} NPD response records.`);

    // 9. Export Audit Logs
    console.log('Exporting Audit Logs...');
    const auditLogs = await sharepointAudit.getAuditLogs();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'audit.json'), JSON.stringify(auditLogs, null, 2));
    console.log(`Exported ${auditLogs.length} audit logs.`);

    console.log('SharePoint Data Export Completed Successfully.');
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

runExport();
