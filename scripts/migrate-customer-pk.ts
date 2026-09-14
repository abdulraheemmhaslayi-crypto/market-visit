import pool from '../lib/db';

async function run() {
  console.log('Starting migration to alter Customer primary key to cust_rt_id...');
  const connection = await pool.getConnection();

  try {
    // Disable foreign key checks during constraints alteration
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const dropConstraint = async (table: string, fkName: string) => {
      try {
        await connection.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``);
        console.log(`Successfully dropped FK ${fkName} from ${table}`);
      } catch (e: any) {
        console.log(`Note: FK ${fkName} from ${table} not dropped: ${e.message}`);
      }
    };

    // Drop legacy foreign keys
    await dropConstraint('CustomerRouteMapping', 'CustomerRouteMapping_ibfk_1');
    await dropConstraint('Customer_Classification', 'Customer_Classification_ibfk_1');
    await dropConstraint('Visit', 'Visit_ibfk_2');

    // Drop primary key on Customer
    try {
      await connection.query('ALTER TABLE `Customer` DROP PRIMARY KEY');
      console.log('Successfully dropped Customer primary key (customerCode)');
    } catch (e: any) {
      console.log(`Note: Customer primary key not dropped: ${e.message}`);
    }

    // Ensure all cust_rt_id values are populated and non-null
    console.log('Populating cust_rt_id values...');
    await connection.query(
      "UPDATE `Customer` SET `cust_rt_id` = CONCAT(`customerCode`, '|', IFNULL(`routeCode`, '')) WHERE `cust_rt_id` IS NULL OR `cust_rt_id` = ''"
    );
    await connection.query('ALTER TABLE `Customer` MODIFY COLUMN `cust_rt_id` VARCHAR(191) NOT NULL');
    await connection.query('ALTER TABLE `Customer` MODIFY COLUMN `routeCode` VARCHAR(191) NOT NULL');

    // Add new primary key on cust_rt_id for Customer
    try {
      await connection.query('ALTER TABLE `Customer` ADD PRIMARY KEY (`cust_rt_id`)');
      console.log('Successfully added Customer PRIMARY KEY on cust_rt_id');
    } catch (e: any) {
      console.log(`Error adding Customer PRIMARY KEY: ${e.message}`);
    }

    // Alter CustomerRouteMapping
    try {
      await connection.query('ALTER TABLE `CustomerRouteMapping` DROP PRIMARY KEY');
    } catch (e: any) {
      // Ignored if it doesn't have composite primary key
    }
    await connection.query(
      "UPDATE `CustomerRouteMapping` SET `cust_rt_id` = CONCAT(`customerCode`, '|', `routeCode`) WHERE `cust_rt_id` IS NULL OR `cust_rt_id` = ''"
    );
    await connection.query('ALTER TABLE `CustomerRouteMapping` MODIFY COLUMN `cust_rt_id` VARCHAR(191) NOT NULL');
    try {
      await connection.query('ALTER TABLE `CustomerRouteMapping` ADD PRIMARY KEY (`cust_rt_id`)');
      console.log('Successfully added CustomerRouteMapping primary key on cust_rt_id');
    } catch (e: any) {
      console.log(`Error adding CustomerRouteMapping primary key: ${e.message}`);
    }

    // Add new foreign key constraints pointing to Customer(cust_rt_id)
    try {
      await connection.query(
        'ALTER TABLE `CustomerRouteMapping` ADD CONSTRAINT `fk_crm_customer` FOREIGN KEY (`cust_rt_id`) REFERENCES `Customer` (`cust_rt_id`) ON DELETE CASCADE'
      );
      console.log('Successfully created fk_crm_customer constraint');
    } catch (e: any) {
      console.log(`Error adding fk_crm_customer: ${e.message}`);
    }

    try {
      await connection.query(
        'ALTER TABLE `Visit` ADD CONSTRAINT `fk_visit_cust_rt` FOREIGN KEY (`cust_rt_id`) REFERENCES `Customer` (`cust_rt_id`) ON DELETE CASCADE'
      );
      console.log('Successfully created fk_visit_cust_rt constraint');
    } catch (e: any) {
      console.log(`Error adding fk_visit_cust_rt: ${e.message}`);
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database migration completed successfully!');
  } catch (err: any) {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    connection.release();
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
