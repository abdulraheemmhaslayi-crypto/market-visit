import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

import pool from '../lib/db';
import { User, Route, Customer, CustomerRouteMapping, SKU, Visit, VisitPhoto, NPDResponse, AuditLog } from '../types';

const INPUT_DIR = path.join(process.cwd(), 'data', 'migration');

const readJsonFile = <T>(filename: string): T[] => {
  const filePath = path.join(INPUT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filename} not found, skipping.`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T[];
};

async function runImport() {
  console.log('Starting MySQL Data Import...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Import Users
    console.log('Importing Users...');
    const users = readJsonFile<User>('users.json');
    for (const u of users) {
      // Clean up role and status values (just in case)
      const role = u.role === 'Admin' || u.role === 'Supervisor' ? u.role : 'Supervisor';
      const status = u.status === 'Active' || u.status === 'Inactive' ? u.status : 'Inactive';
      const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();

      await connection.execute(
        `INSERT INTO User (id, name, employeeCode, email, passwordHash, mobile, role, status, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), passwordHash=VALUES(passwordHash), 
                                 mobile=VALUES(mobile), role=VALUES(role), status=VALUES(status)`,
        [u.id, u.name, u.employeeCode, u.email, u.passwordHash, u.mobile, role, status, createdAt]
      );
    }
    console.log(`Imported/Updated ${users.length} Users.`);

    // 2. Import Routes
    console.log('Importing Routes...');
    const routes = readJsonFile<Route>('routes.json');
    for (const r of routes) {
      await connection.execute(
        `INSERT INTO Route (routeCode, routeName) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE routeName=VALUES(routeName)`,
        [r.routeCode, r.routeName]
      );
    }
    console.log(`Imported/Updated ${routes.length} Routes.`);

    // 3. Import Customers
    console.log('Importing Customers...');
    const customers = readJsonFile<Customer>('customers.json');
    for (const c of customers) {
      await connection.execute(
        `INSERT INTO Customer (cust_rt_id, customerCode, customerName, classification, dairyClassification, iceCreamClassification, channel, routeCode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE customerName=VALUES(customerName), classification=VALUES(classification), 
                                 dairyClassification=COALESCE(VALUES(dairyClassification), Customer.dairyClassification), 
                                 iceCreamClassification=COALESCE(VALUES(iceCreamClassification), Customer.iceCreamClassification), 
                                 channel=VALUES(channel)`,
        [c.cust_rt_id || `${c.customerCode}|${c.routeCode || ''}`, c.customerCode, c.customerName, c.classification, c.dairyClassification || null, c.iceCreamClassification || null, c.channel, c.routeCode || null]
      );
      if (c.dairyClassification) {
        await connection.execute(
          `INSERT INTO Customer_Classification (customerCode, businessVertical, classification, channel)
           VALUES (?, 'Dairy', ?, ?)
           ON DUPLICATE KEY UPDATE classification=VALUES(classification), channel=VALUES(channel)`,
          [c.customerCode, c.dairyClassification, c.channel]
        );
      }
      if (c.iceCreamClassification) {
        await connection.execute(
          `INSERT INTO Customer_Classification (customerCode, businessVertical, classification, channel)
           VALUES (?, 'Ice Cream', ?, ?)
           ON DUPLICATE KEY UPDATE classification=VALUES(classification), channel=VALUES(channel)`,
          [c.customerCode, c.iceCreamClassification, c.channel]
        );
      }
    }
    console.log(`Imported/Updated ${customers.length} Customers.`);

    // 4. Import CustomerRouteMappings
    console.log('Importing Mappings...');
    const mappings = readJsonFile<CustomerRouteMapping>('mappings.json');
    let mappingCount = 0;
    for (const m of mappings) {
      if (!m.customerCode || !m.routeCode) continue;
      // Using INSERT IGNORE since this has composite primary key and mappings could contain duplicate pairs in SharePoint
      await connection.execute(
        `INSERT IGNORE INTO CustomerRouteMapping (customerCode, routeCode) VALUES (?, ?)`,
        [m.customerCode, m.routeCode]
      );
      mappingCount++;
    }
    console.log(`Imported ${mappingCount} Customer-Route Mappings.`);

    // 5. Import SKUs
    console.log('Importing SKUs...');
    const skus = readJsonFile<SKU>('skus.json');
    for (const s of skus) {
      await connection.execute(
        `INSERT INTO SKU (skuCode, skuName) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE skuName=VALUES(skuName)`,
        [s.skuCode, s.skuName]
      );
    }
    console.log(`Imported/Updated ${skus.length} SKUs.`);

    // 6. Import Visits
    console.log('Importing Visits...');
    const visits = readJsonFile<Visit>('visits.json');
    for (const v of visits) {
      // Validate enums
      const assetType = v.assetType === 'Chiller' || v.assetType === 'Freezer' ? v.assetType : 'Chiller';
      const actionRequired = ['Cleaning', 'Repair', 'Replacement', 'Gas Filling', 'Other', 'None'].includes(v.actionRequired) 
        ? v.actionRequired 
        : 'None';
      const status = v.status === 'Draft' || v.status === 'Submitted' ? v.status : 'Draft';
      const createdAt = v.createdAt ? new Date(v.createdAt) : new Date();
      const updatedAt = v.updatedAt ? new Date(v.updatedAt) : new Date();
      const tempInRange = v.tempInRange ? 1 : 0;

      await connection.execute(
        `INSERT INTO Visit (visitId, supervisorId, routeCode, customerCode, assetType, temperature, tempInRange, actionRequired, observation, latitude, longitude, accuracy, status, createdBy, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE supervisorId=VALUES(supervisorId), routeCode=VALUES(routeCode), customerCode=VALUES(customerCode), 
                                 assetType=VALUES(assetType), temperature=VALUES(temperature), tempInRange=VALUES(tempInRange), 
                                 actionRequired=VALUES(actionRequired), observation=VALUES(observation), latitude=VALUES(latitude), 
                                 longitude=VALUES(longitude), accuracy=VALUES(accuracy), status=VALUES(status), 
                                 createdBy=VALUES(createdBy), createdAt=VALUES(createdAt), updatedAt=VALUES(updatedAt)`,
        [
          v.visitId, v.supervisorId, v.routeCode || null, v.customerCode || null, assetType, 
          v.temperature, tempInRange, actionRequired, v.observation, 
          v.latitude, v.longitude, v.accuracy, status, v.createdBy, 
          createdAt, updatedAt
        ]
      );
    }
    console.log(`Imported/Updated ${visits.length} Visits.`);

    // 7. Import Photos
    console.log('Importing Photos...');
    const photos = readJsonFile<VisitPhoto>('photos.json');
    for (const p of photos) {
      const category = ['Dairy', 'Beverages', 'Ice Cream', 'Vegetables'].includes(p.category) ? p.category : 'Dairy';
      const uploadedAt = p.uploadedAt ? new Date(p.uploadedAt) : new Date();

      await connection.execute(
        `INSERT INTO VisitPhoto (photoId, visitId, category, cloudinaryUrl, publicId, uploadedAt) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE visitId=VALUES(visitId), category=VALUES(category), 
                                 cloudinaryUrl=VALUES(cloudinaryUrl), publicId=VALUES(publicId), uploadedAt=VALUES(uploadedAt)`,
        [p.photoId, p.visitId, category, p.cloudinaryUrl, p.publicId, uploadedAt]
      );
    }
    console.log(`Imported/Updated ${photos.length} Photos.`);

    // 8. Import NPD Responses
    console.log('Importing NPD Responses...');
    const npdList = readJsonFile<NPDResponse>('npd.json');
    let npdCount = 0;
    for (const n of npdList) {
      const status = ['Available', 'Not Available', 'Not Required'].includes(n.status) ? n.status : 'Not Required';
      await connection.execute(
        `INSERT INTO NPDResponse (visitId, skuCode, status) VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [n.visitId, n.skuCode, status]
      );
      npdCount++;
    }
    console.log(`Imported/Updated ${npdCount} NPD Responses.`);

    // 9. Import Audit Logs
    console.log('Importing Audit Logs...');
    const auditLogs = readJsonFile<AuditLog>('audit.json');
    for (const a of auditLogs) {
      const createdAt = a.createdAt ? new Date(a.createdAt) : new Date();
      await connection.execute(
        `INSERT INTO AuditLog (logId, user, action, entity, createdAt) VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE user=VALUES(user), action=VALUES(action), entity=VALUES(entity), createdAt=VALUES(createdAt)`,
        [a.logId, a.user, a.action, a.entity, createdAt]
      );
    }
    console.log(`Imported/Updated ${auditLogs.length} Audit Logs.`);

    await connection.commit();
    console.log('MySQL Database Import Completed Successfully.');
  } catch (error) {
    await connection.rollback();
    console.error('Import failed, transaction rolled back:', error);
    process.exit(1);
  } finally {
    connection.release();
  }
}

runImport();
