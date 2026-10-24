const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const CANONICAL_USERS = [
  {
    id: 'usr_003xs5n',
    name: 'RIZVI',
    employeeCode: 'SUP011',
    email: 'rizvi@marketvisit.com',
    mobile: '+97466450058',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'rizvi@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_mansoor',
    name: 'Mansoor',
    employeeCode: 'SUP0015',
    email: 'mansoor@dandy.qa',
    mobile: '+97450410091',
    role: 'Fleet',
    status: 'Active',
    defaultPassword: 'mansoor@12345',
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'usr_juned',
    name: 'juned',
    employeeCode: 'SUP0016',
    email: 'juned@dandy.qa',
    mobile: '+97433603802',
    role: 'Fleet',
    status: 'Active',
    defaultPassword: 'juned@12345',
    createdAt: '2026-09-15T00:00:00.000Z',
  },
  {
    id: 'usr_5ab06hm',
    name: 'YASAR',
    employeeCode: 'SUP009',
    email: 'yasar@marketvisit.com',
    mobile: '+97433195649',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'yasar@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_9rmd7jo',
    name: 'WASIM',
    employeeCode: 'SUP016',
    email: 'wasim@marketvisit.com',
    mobile: '+97433198280',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'wasim@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_a98ufvf',
    name: 'WALI',
    employeeCode: 'SUP007',
    email: 'wali@marketvisit.com',
    mobile: '+97466934767',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'wali@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_dw607k6',
    name: 'KISHAN',
    employeeCode: 'SUP005',
    email: 'kishan@marketvisit.com',
    mobile: '+97450396891',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'kishan@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_f69dr5u',
    name: 'Admin',
    employeeCode: 'ADMIN001',
    email: 'admin@marketvisit.com',
    mobile: '+97450828097',
    role: 'Admin',
    status: 'Active',
    defaultPassword: 'admin@123',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_gyye49e',
    name: 'ZEESHAN',
    employeeCode: 'SUP010',
    email: 'zeeshan@marketvisit.com',
    mobile: '+97433536449',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'zeeshan@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_p1facpm',
    name: 'DANISH',
    employeeCode: 'Sup002',
    email: 'danish@marketvisit.com',
    mobile: '+97455371973',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'danish@12345',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_pil4rn7',
    name: 'ASAD',
    employeeCode: 'SUP0061',
    email: 'asad@marketvisit.com',
    mobile: '+97433095605',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'asad@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_rqupsuk',
    name: 'subadmin',
    employeeCode: 'SUB01',
    email: 'subadmin@marketvisit.com',
    mobile: '+97450828097',
    role: 'Sub-Admin',
    status: 'Active',
    defaultPassword: 'subadmin@12345',
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'usr_rqwxav8',
    name: 'SAIFULLAH',
    employeeCode: 'SUP014',
    email: 'saifullah@marketvisit.com',
    mobile: '+97433099647',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'saifullah@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_sup001',
    name: 'Supervisor User',
    employeeCode: 'SUP001',
    email: 'supervisor@marketvisit.com',
    mobile: '9876543210',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'supervisor@123',
    createdAt: '2026-08-04T00:00:00.000Z',
  },
  {
    id: 'usr_tgb2s6h',
    name: 'SAIF',
    employeeCode: 'SUP008',
    email: 'saif@marketvisit.com',
    mobile: '+97433080436',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'saif@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_tokhkzo',
    name: 'MUSAVEER',
    employeeCode: 'SUP006',
    email: 'musaveer@marketvisit.com',
    mobile: '+97450644243',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'musaveer@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_vepni0r',
    name: 'RASHWIN',
    employeeCode: 'SUP015',
    email: 'rashwin@marketvisit.com',
    mobile: '+97466237411',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'rashwin@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_wrbc47b',
    name: 'JAVED',
    employeeCode: 'SUP004',
    email: 'javed@marketvisit.com',
    mobile: '+97433483049',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'javed@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_x315bhi',
    name: 'JAHID',
    employeeCode: 'SUP003',
    email: 'jahid@marketvisit.com',
    mobile: '+97433195991',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'jahid@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'usr_xojy60l',
    name: 'MOHSIN',
    employeeCode: 'SUP012',
    email: 'mohsin@marketvisit.com',
    mobile: '+97455764631',
    role: 'Supervisor',
    status: 'Active',
    defaultPassword: 'mohsin@12345',
    createdAt: '2026-08-06T00:00:00.000Z',
  },
];

async function syncUsers() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [existingRows] = await conn.query('SELECT * FROM `User`');
    console.log(`Currently found ${existingRows.length} users in database.`);

    for (const u of CANONICAL_USERS) {
      const passwordHash = bcrypt.hashSync(u.defaultPassword, 10);
      const match = existingRows.find(
        (ex) =>
          (ex.email && ex.email.toLowerCase() === u.email.toLowerCase()) ||
          (ex.name && ex.name.toUpperCase().trim() === u.name.toUpperCase().trim()) ||
          (ex.employeeCode && ex.employeeCode.toUpperCase().trim() === u.employeeCode.toUpperCase().trim())
      );

      if (!match) {
        console.log(`Inserting new user: ${u.name} (${u.employeeCode})`);
        await conn.query(
          'INSERT INTO `User` (id, name, employeeCode, email, passwordHash, mobile, role, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [u.id, u.name, u.employeeCode, u.email, passwordHash, u.mobile, u.role, u.status, new Date(u.createdAt)]
        );
      } else {
        console.log(`Updating user: ${u.name} (id: ${match.id}, code: ${u.employeeCode})`);
        await conn.query(
          'UPDATE `User` SET name = ?, employeeCode = ?, email = ?, mobile = ?, role = ?, status = ?, passwordHash = ? WHERE id = ?',
          [u.name, u.employeeCode, u.email, u.mobile, u.role, u.status, passwordHash, match.id]
        );
      }
    }

    const [finalUsers] = await conn.query('SELECT id, name, employeeCode, email, mobile, role, status FROM `User` ORDER BY name ASC');
    console.log(`Finished sync. Total users now: ${finalUsers.length}`);
    console.table(finalUsers);
  } finally {
    await conn.end();
  }
}

syncUsers().catch(console.error);
