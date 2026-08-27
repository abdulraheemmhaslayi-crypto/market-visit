import fs from 'fs';
import path from 'path';
import {
  User,
  Route,
  Customer,
  CustomerRouteMapping,
  SKU,
  Visit,
  VisitPhoto,
  NPDResponse,
  AuditLog,
} from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');

// Helper to ensure data folder exists
const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

// Generic read/write helpers
const readDataFile = <T>(filename: string, defaultData: T[]): T[] => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch (error) {
    console.error(`Error reading mock file ${filename}:`, error);
    return defaultData;
  }
};

const writeDataFile = <T>(filename: string, data: T[]): void => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Standard initial mock data
const initialUsers = (): User[] => [
  {
    id: 'user_1',
    name: 'System Admin',
    employeeCode: 'ADM001',
    email: 'admin@system.local',
    //password: password123
    // bcrypt hash of "password123"
    passwordHash: '$2b$10$xANokfvRXd/XsM009BIC1euSO5eHLed8NrkJzI669T924C6Btn2uW',
    mobile: '9876543210',
    role: 'Admin',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_2',
    name: 'John Doe',
    employeeCode: 'SUP001',
    email: 'john@system.local',
     //password: password123
    // bcrypt hash of "password123"
    passwordHash: '$2b$10$xANokfvRXd/XsM009BIC1euSO5eHLed8NrkJzI669T924C6Btn2uW',
    mobile: '9876543211',
    role: 'Supervisor',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_3',
    name: 'Jane Smith',
    employeeCode: 'SUP002',
    email: 'jane@system.local',
    // bcrypt hash of "password123"
    passwordHash: '$2b$10$xANokfvRXd/XsM009BIC1euSO5eHLed8NrkJzI669T924C6Btn2uW',
    mobile: '9876543212',
    role: 'Supervisor',
    status: 'Inactive', // Test inactive status
    createdAt: new Date().toISOString(),
  },
];

const initialRoutes = (): Route[] => [
  { routeCode: 'R01', routeName: 'Downtown Route A', channel: 'GT' },
  { routeCode: 'R02', routeName: 'Uptown Route B', channel: 'MT' },
  { routeCode: 'R03', routeName: 'Suburban Route C', channel: 'GT' },
];

const initialCustomers = (): Customer[] => [
  { cust_rt_id: 'C001|R01', customerCode: 'C001', customerName: 'Mart Superstore', classification: 'A', channel: 'Modern Trade', routeCode: 'R01' },
  { cust_rt_id: 'C002|R01', customerCode: 'C002', customerName: 'Apex Grocery', classification: 'B', channel: 'General Trade', routeCode: 'R01' },
  { cust_rt_id: 'C003|R02', customerCode: 'C003', customerName: 'Corner Store Daily', classification: 'C', channel: 'General Trade', routeCode: 'R02' },
  { cust_rt_id: 'C004|R02', customerCode: 'C004', customerName: 'Metro Food Plaza', classification: 'A', channel: 'Modern Trade', routeCode: 'R02' },
  { cust_rt_id: 'C005|R03', customerCode: 'C005', customerName: 'Highway Refreshments', classification: 'D', channel: 'QSR', routeCode: 'R03' },
];

const initialMappings = (): CustomerRouteMapping[] => [
  { cust_rt_id: 'C001|R01', customerCode: 'C001', routeCode: 'R01' },
  { cust_rt_id: 'C002|R01', customerCode: 'C002', routeCode: 'R01' },
  { cust_rt_id: 'C003|R02', customerCode: 'C003', routeCode: 'R02' },
  { cust_rt_id: 'C004|R02', customerCode: 'C004', routeCode: 'R02' },
  { cust_rt_id: 'C005|R03', customerCode: 'C005', routeCode: 'R03' },
  { cust_rt_id: 'C001|R03', customerCode: 'C001', routeCode: 'R03' }, // Customer 1 on Route 3 as well
];

const initialSKUs = (): SKU[] => [
  { skuCode: 'SKU01', skuName: 'Milk Shake Chocolate 250ml', type: 'SKU' },
  { skuCode: 'SKU02', skuName: 'Premium Ice Cream Vanilla 1L', type: 'SKU' },
  { skuCode: 'SKU03', skuName: 'Mango Juice Bottle 500ml', type: 'SKU' },
  { skuCode: 'SKU04', skuName: 'Frozen Yogurt Cup 150ml', type: 'SKU' },
];

export const mockDb = {
  getUsers: () => readDataFile<User>('users.json', initialUsers()),
  saveUsers: (data: User[]) => writeDataFile<User>('users.json', data),

  getRoutes: () => readDataFile<Route>('routes.json', initialRoutes()),
  saveRoutes: (data: Route[]) => writeDataFile<Route>('routes.json', data),

  getCustomers: () => readDataFile<Customer>('customers.json', initialCustomers()),
  saveCustomers: (data: Customer[]) => writeDataFile<Customer>('customers.json', data),

  getMappings: () => readDataFile<CustomerRouteMapping>('mappings.json', initialMappings()),
  saveMappings: (data: CustomerRouteMapping[]) => writeDataFile<CustomerRouteMapping>('mappings.json', data),

  getSKUs: () => readDataFile<SKU>('skus.json', initialSKUs()),
  saveSKUs: (data: SKU[]) => writeDataFile<SKU>('skus.json', data),

  getVisits: () => readDataFile<Visit>('visits.json', []),
  saveVisits: (data: Visit[]) => writeDataFile<Visit>('visits.json', data),

  getPhotos: () => readDataFile<VisitPhoto>('photos.json', []),
  savePhotos: (data: VisitPhoto[]) => writeDataFile<VisitPhoto>('photos.json', data),

  getNpdResponses: () => readDataFile<NPDResponse>('npd.json', []),
  saveNpdResponses: (data: NPDResponse[]) => writeDataFile<NPDResponse>('npd.json', data),

  getAuditLogs: () => readDataFile<AuditLog>('audit.json', []),
  saveAuditLogs: (data: AuditLog[]) => writeDataFile<AuditLog>('audit.json', data),
};
