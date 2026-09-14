# Classification Display Fix Guide

## Problem
Customer classifications are not showing on the outlet card/selection after the per-vertical (Dairy + Ice Cream) schema change. Example: C00240 (Qmc-Sana) has Dairy=C and Ice Cream=B in the master, but the app shows no class.

## Root Cause
The `dairyClassification` and `iceCreamClassification` database columns are NULL for existing customer records. These columns need to be populated from the Master_Classification import file.

## Solution: 3-Step Fix

### Step 1: Verify Current Database State

Run this diagnostic to check if data exists:

```bash
# Check overall stats
curl "http://localhost:3000/api/debug/customer-classification" \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>"

# Check specific customer (C00240)
curl "http://localhost:3000/api/debug/customer-classification?customerCode=C00240" \
  -H "Authorization: Bearer <YOUR_ADMIN_TOKEN>"
```

Expected output if problem exists:
```json
{
  "found": true,
  "records": [{
    "customerCode": "00240",
    "customerName": "Qmc-Sana",
    "dairyClassification": null,
    "iceCreamClassification": null
  }]
}
```

### Step 2: Run Migration Script

If dairyClassification and iceCreamClassification are NULL, run the migration:

```bash
# Copy your Master_Classification file to public/uploads/
cp /path/to/Master_Classification.xlsx public/uploads/

# Run migration
npx ts-node scripts/migrate-classifications.ts
```

The script will:
1. Find the classification file in public/uploads/
2. Parse it and extract customer classifications
3. Update the database with proper Dairy and Ice Cream classes
4. Verify the fix for C00240

Expected output:
```
✅ C00240: Dairy = C
✅ C00240: Ice Cream = B
```

### Step 3: Verify the Fix

Check that outlets now display both classes:

1. Go to Supervisor Visit (New Audit)
2. Select a route
3. View the outlet picker
4. Verify C00240 shows:
   - "Class C · Dairy" badge
   - "Class B · Ice Cream" badge

Test with at least 3 outlets:
- ✅ C00240 (Dairy=C, Ice Cream=B) - should show both
- ✅ 3 more outlets with real classes - should show both
- ✅ 1 outlet with "-" in both verticals - should show "Not classified"

## Data Flow Verification

If step 2 doesn't work, verify the import process:

1. **Ensure Classification File Was Imported**
   - Go to Admin → Import Master Data
   - Upload the Master_Classification file
   - Check for any error messages

2. **Verify File Format**
   The file must have these columns:
   - Customer Code
   - Customer Name (or similar)
   - Classification (or Class, Grade, etc.)
   - Channel (or similar)
   - Business Vertical (or Vertical, BusinessVertical, etc.)

3. **Check Customer Codes Match**
   - Classification file must have same customer codes as CUSTMASTER
   - Each customer can appear 2 rows: once for Dairy, once for Ice Cream
   - Example:
     ```
     CustomerCode | CustomerName | Classification | Channel | BusinessVertical
     00240        | Qmc-Sana     | C               | TT      | Dairy
     00240        | Qmc-Sana     | B               | TT      | Ice Cream
     ```

## Troubleshooting

### Issue: Migration script says "No classification file found"
**Solution**: Copy Master_Classification file to `public/uploads/` before running the script

### Issue: Migration says file found but no customers updated
**Solution**: Check the file format - columns must include:
- Customer Code (or similar)
- Classification
- Business Vertical

### Issue: Still no classification showing after migration
**Solution**: Clear browser cache (Ctrl+Shift+Delete) and reload the page

## Rollback

If something goes wrong:

```sql
-- Reset classifications to NULL (if needed)
UPDATE Customer SET dairyClassification = NULL, iceCreamClassification = NULL;

-- Then run migration again
npx ts-node scripts/migrate-classifications.ts
```

## Technical Details

### Database Schema
The Customer table has these columns:
- `dairyClassification` VARCHAR(50) - stores A, B, C, D, E, or - (dash for not classified)
- `iceCreamClassification` VARCHAR(50) - same format

### UI Display Rules
Outlet badges show:
- If both classes exist: "Class C · Dairy" + "Class B · Ice Cream"
- If only one: show that one
- If both "-": show "Not classified"
- If data missing (NULL): no badge shown

### Import Process
When Master_Classification file is imported:
1. Parser finds columns using fuzzy matching
2. Normalizes business vertical (Dairy/Ice Cream/icecream/ice-cream → canonical key)
3. Builds map: `customerCode|vertical` → classification
4. For each customer in CUSTMASTER, looks up dairy and ice cream classes
5. Stores in dairyClassification and iceCreamClassification columns
