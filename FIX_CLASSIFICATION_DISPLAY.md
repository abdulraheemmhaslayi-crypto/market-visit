# Fix Classification Display - Action Plan

## Problem Statement
Customer classifications are not showing on the outlet card after the per-vertical schema change.

**Example:** Customer C00240 (Qmc-Sana) has classifications in the master (Dairy=C, Ice Cream=B), but the app shows no class badges.

## Root Cause
The `dairyClassification` and `iceCreamClassification` database columns are NULL/empty for existing customer records because:
1. The schema was changed to add these columns
2. Existing customer records were created before classifications were imported
3. The classification data needs to be populated from the Master_Classification file

## Solution: 3-Step Fix Process

### ✅ Step 1: Diagnose Current State

Check if the data exists in the database:

```bash
# Quick check - see overall stats
curl -X GET "http://localhost:3000/api/debug/customer-classification" \
  -H "Cookie: [your-auth-cookie]"

# Check specific customer
curl -X GET "http://localhost:3000/api/debug/customer-classification?customerCode=00240" \
  -H "Cookie: [your-auth-cookie]"
```

**Expected if problem exists:**
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

### ✅ Step 2: Populate Classifications (Choose One Method)

#### **Option A: Re-import Classification File (Recommended)**

1. Go to **Admin → Import Master Data**
2. Upload **Master_Classification** file
3. Ensure file has these columns:
   - Customer Code (e.g., "00240" or "C00240")
   - Classification (A-E or dash -)
   - Business Vertical (Dairy/Ice Cream)
   - Channel (TT/MT/INST/EXPORT)

4. File format example:
   ```
   Customer Code | Customer Name | Classification | Channel | Business Vertical
   00240         | Qmc-Sana      | C               | TT      | Dairy
   00240         | Qmc-Sana      | B               | TT      | Ice Cream
   ```

5. Submit import - system will populate dairyClassification and iceCreamClassification

#### **Option B: Run Migration Script**

If you have the classification file available locally:

```bash
# Copy file to project
cp /path/to/Master_Classification.xlsx public/uploads/

# Run migration (auto-detects file in uploads/)
npx ts-node scripts/migrate-classifications.ts
```

The script will:
- Find the classification file in public/uploads/
- Parse customer-vertical-classification mappings
- Update database with proper values
- Verify C00240 has Dairy=C and Ice Cream=B

#### **Option C: Direct API Update**

Use the admin API to directly set classifications:

```bash
curl -X POST "http://localhost:3000/api/admin/update-classifications" \
  -H "Cookie: [your-auth-cookie]" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {
        "customerCode": "00240",
        "dairyClassification": "C",
        "iceCreamClassification": "B"
      }
    ]
  }'
```

Response:
```json
{
  "success": true,
  "total": 1,
  "updated": 1,
  "results": [{
    "customerCode": "00240",
    "status": "success",
    "dairy": "C",
    "ice": "B",
    "affectedRows": 1
  }]
}
```

### ✅ Step 3: Verify the Fix

1. **Run test script** (optional):
   ```bash
   npx ts-node scripts/test-classifications.ts
   ```

2. **Manual verification in app:**
   - Go to **Supervisor → New Audit**
   - Select any route
   - Look at the Outlet Picker
   - **C00240 should now show:**
     - `Class C · Dairy` badge
     - `Class B · Ice Cream` badge

3. **Test with multiple customers:**
   - ✅ C00240 (should show: Class C · Dairy + Class B · Ice Cream)
   - ✅ 2-3 more classified outlets (verify badges display)
   - ✅ 1 unclassified outlet (verify it shows: Not classified · Dairy/Ice Cream if truly unclassified)

## Expected Behavior After Fix

### Outlet Card Display
Shows badges for each classified vertical:
```
[C00240] [Class C · Dairy] [Class B · Ice Cream] [TT]
```

### If Only One Vertical Classified
```
[C00325] [Class A · Dairy] [INST]
```

### If Not Classified (dash -)
```
[C00500] [Not classified · Dairy] [Not classified · Ice Cream] [MT]
```

### If Data Missing (NULL)
No classification badges shown - only customer code and channel.

## Troubleshooting

### Problem: "No classification file found" error
**Solution:** Ensure Master_Classification file is in `public/uploads/` directory before running migration script.

### Problem: Migration says file found but no records updated
**Solution:** 
- Verify column headers in file match expected names
- Check that customer codes match between files (00240 vs C00240)
- Try Option C (Direct API) to manually test a single customer

### Problem: Still not showing after Step 3
**Troubleshooting:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Reload page
3. Re-run diagnostic:
   ```bash
   curl "http://localhost:3000/api/debug/customer-classification?customerCode=00240"
   ```
4. If dairyClassification still NULL, repeat Step 2

### Problem: Some customers show, some don't
**Cause:** Classifications only populate for customers that appear in BOTH:
- CUSTMASTER file (creates customer records)
- Master_Classification file (provides dairy/ice cream classes)

**Solution:** Ensure Master_Classification file includes all required customers

## Data Requirements

### CUSTMASTER file must have:
- Customer Code
- Customer Name
- Route Code
- (Creates customer records in database)

### Master_Classification file must have:
- Customer Code (matching CUSTMASTER)
- Classification (A, B, C, D, E, or -)
- Business Vertical (Dairy or Ice Cream)
- Channel (TT/MT/INST/EXPORT)
- (Populates dairy/ice cream classifications)

**Key: Each customer appears 2 rows minimum (Dairy + Ice Cream)**

## Database Fields

### Customer table columns:
- `dairyClassification` VARCHAR(50) - stores A/B/C/D/E/- for Dairy
- `iceCreamClassification` VARCHAR(50) - stores A/B/C/D/E/- for Ice Cream
- Both can be NULL if data missing
- Dash (-) means "not classified yet"

## UI Logic

The outlet picker displays classifications IF:
- Field is not NULL (has a value)
- Field is not empty string
- Shows badge: `Class [VALUE] · [Vertical]`
- If value is dash (-): shows `Not classified · [Vertical]` instead

## Rollback

If you need to reset and try again:

```sql
-- Clear classifications (DANGER: destructive)
UPDATE Customer SET dairyClassification = NULL, iceCreamClassification = NULL;

-- Then re-run import or migration
```

## Success Criteria

✅ All 3 items must be true:

1. **Diagnostic endpoint shows data:**
   - dairyClassification has value (A-E or -)
   - iceCreamClassification has value (A-E or -)

2. **UI shows badges:**
   - Outlet picker displays Class badges
   - C00240 shows both Dairy C and Ice Cream B

3. **Test suite passes:**
   - Run: `npx ts-node scripts/test-classifications.ts`
   - All outputs show ✅ (not ❌)

---

**Support Files Created:**
- `/app/api/debug/customer-classification` - Diagnostic endpoint
- `/app/api/admin/update-classifications` - Bulk update API
- `/scripts/migrate-classifications.ts` - Migration script
- `/scripts/test-classifications.ts` - Test/verification script
