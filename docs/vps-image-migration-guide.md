# VPS Image Migration & Deployment Guide (Cloudinary to Local Storage)

This guide provides the exact step-by-step commands to migrate all Cloudinary images to local VPS storage and configure Apache & PM2 on your Ubuntu VPS.

---

## 1. Directory Structure & Permissions Setup

On your VPS terminal (`/var/www/market-visit`):

```bash
# 1. Create the uploads directory and subdirectories
mkdir -p /var/www/market-visit/uploads/visit-photos
mkdir -p /var/www/market-visit/uploads/visit-assets
mkdir -p /var/www/market-visit/uploads/customer-images

# 2. Check which user runs PM2
pm2 list
# Or check the current active user:
whoami

# 3. Set proper ownership and permissions
# (Replace 'ubuntu' with the actual Linux user running PM2)
sudo chown -R ubuntu:www-data /var/www/market-visit/uploads

# 4. Give PM2 user full read/write, and Apache (www-data) read/execute access
sudo chmod -R 775 /var/www/market-visit/uploads
```

---

## 2. Apache VirtualHost Configuration

Ensure the necessary Apache modules are enabled:

```bash
sudo a2enmod proxy proxy_http alias headers rewrite
```

Edit your Apache site configuration (e.g. `/etc/apache2/sites-available/market-visit.conf`):

```apache
<VirtualHost *:80>
    ServerName dandyapp.tech
    ServerAlias www.dandyapp.tech

    # 1. EXCLUDE /uploads from ProxyPass (CRITICAL)
    ProxyPass /uploads !

    # 2. Directly serve /uploads from local storage directory
    Alias /uploads /var/www/market-visit/uploads

    <Directory /var/www/market-visit/uploads>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        <IfModule mod_headers.c>
            Header set Cache-Control "max-age=31536000, public, immutable"
            Header set Access-Control-Allow-Origin "*"
        </IfModule>
    </Directory>

    # 3. Reverse Proxy to Next.js on port 3000
    ProxyRequests Off
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    ErrorLog ${APACHE_LOG_DIR}/market-visit-error.log
    CustomLog ${APACHE_LOG_DIR}/market-visit-access.log combined
</VirtualHost>
```

Test and reload Apache:
```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## 3. Running the Migration (Step-by-Step)

### Step A: Dry Run (Zero Risk - Scan & Verify Candidates)
Scans the entire database dynamically, shows all tables/columns and candidate image records without downloading or altering any database record:

```bash
npx tsx scripts/migrate-cloudinary-to-local.ts --dry-run
```

### Step B: Test with a Small Batch (5 Images)
Download 5 images, validate them, write to `/var/www/market-visit/uploads/`, and update corresponding DB records with full audit tracking:

```bash
npx tsx scripts/migrate-cloudinary-to-local.ts --limit 5
```

**Verification check:**
1. Check that files exist in `/var/www/market-visit/uploads/visit-photos/` with non-zero sizes:
   ```bash
   ls -lh /var/www/market-visit/uploads/visit-photos/
   ```
2. Open a migrated image directly in your browser:
   `https://dandyapp.tech/uploads/visit-photos/<filename>.jpg`
3. Inspect `_image_migration_log` in MySQL:
   ```bash
   mysql -u root -p marketvisit -e "SELECT id, sourceTable, originalImageValue, newLocalImageValue, migrationStatus, fileSizeBytes FROM _image_migration_log LIMIT 5;"
   ```

### Step C: Run Full Resumable Migration
Once the test batch is confirmed, run the full migration. Already migrated records will be automatically skipped:

```bash
npx tsx scripts/migrate-cloudinary-to-local.ts --resume
```

---

## 4. Verification & Reports

Inspect the generated JSON reports:
```bash
# View summary report
cat migration-report-*.json

# View failure log (if any)
cat migration-failures-*.json
```

---

## 5. Build and Restart Next.js via PM2

```bash
# 1. Build Next.js
npm run build

# 2. Restart PM2 process
pm2 restart all
# Or if your app has a specific name:
pm2 restart market-app

# 3. Check logs
pm2 logs --lines 50
```
