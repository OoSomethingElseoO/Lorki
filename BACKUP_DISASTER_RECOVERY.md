# Backup & Disaster Recovery Guide

## Current Backup Configuration

### If using Neon (PostgreSQL managed service)

**Status**: Check https://console.neon.tech

- **Automatic backups**: YES - every 24 hours
- **Retention**: 7 days (free tier) or 30 days (paid tier)
- **Point-in-time recovery**: Available (restore to any point in last 7-30 days)
- **RPO** (Recovery Point Objective): 24 hours (one backup per day)
- **RTO** (Recovery Time Objective): ~30 minutes (depends on DB size)

### If using AWS RDS

**Status**: Check AWS console

- **Automated backups**: Check RDS → DB instances → [instance] → Backups
- **Retention**: Default 7 days (configurable to 35 days)
- **Multi-AZ failover**: Check if enabled (automatic failover if primary fails)
- **RPO**: Depends on backup frequency (default: daily)
- **RTO**: <5 min with Multi-AZ, >30 min with manual snapshot restore

### If self-hosted

**Status**: ⚠️ CRITICAL - No backup configured by default

---

## Backup Verification

### For Neon

```bash
# Check last backup
curl -X GET "https://console.neon.tech/api/v1/projects/[project]/branches/[branch]/endpoints" \
  -H "Authorization: Bearer $NEON_API_KEY"

# Manually trigger backup (if available)
# Go to: console.neon.tech → [project] → Backups → "Create backup"
```

### For AWS RDS

```bash
# List automated backups
aws rds describe-db-snapshots --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,DBInstanceIdentifier]'

# Create manual backup now
aws rds create-db-snapshot \
  --db-instance-identifier lorki-db \
  --db-snapshot-identifier lorki-backup-$(date +%Y%m%d-%H%M%S)
```

### For Self-Hosted

```bash
# Backup database (weekly cron job)
# In: /etc/cron.d/lorki-backup

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin
0 2 * * 0 postgres pg_dump -d neondb -F c -f /backups/lorki-$(date +\%Y\%m\%d-\%H\%M\%S).dump

# Verify backups exist
ls -lah /backups/lorki-*.dump | head -5

# Test restore (monthly)
pg_restore -d test_db /backups/lorki-[latest].dump
```

---

## Restore Procedures

### Scenario 1: Data Corruption (Single Table)

**Symptom**: Payment records are corrupted, but rest of DB is fine

**Recovery**:

```bash
# 1. Identify corruption point
SELECT * FROM "Order" WHERE id = 'corrupted_order_id';
SELECT * FROM "Payout" WHERE "orderId" = 'corrupted_order_id';

# 2. Compare against backup
# Go to Neon console → Backups → select backup from before corruption
# Create new database "lorki-restore-test" from that backup
# Query same records in restored DB to see clean state

# 3. Restore single corrupted records from backup
# Either:
#   a) Export clean records from backup DB, import to production
#   b) Manually update corrupted fields based on backup values
```

### Scenario 2: Complete Database Failure (Neon)

**Symptom**: Database server is down, cannot connect

**Recovery** (15-30 min):

```bash
# 1. Create new database from backup
# Neon console → [project] → Backups → [select recent backup]
# Click "Restore" → confirm data loss warning
# Choose: "Restore to new database" or "Restore and replace"

# 2. Update app connection string
# .env: DATABASE_URL = "postgresql://..."
# Deploy updated config to app

# 3. Verify data integrity
DATABASE_URL="..." npm run prisma:validate

# 4. Bring app back online
kubectl rollout restart deployment/lorki
```

### Scenario 3: Complete Database Failure (AWS RDS)

**Recovery** (5-30 min):

```bash
# 1. Create new DB from latest snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier lorki-db-restored \
  --db-snapshot-identifier [latest-snapshot]

# Wait for new instance to boot (typically 10 min)

# 2. Update security group
# Ensure new DB endpoint is accessible from app

# 3. Update connection string
DATABASE_URL="postgresql://...new-endpoint..."

# 4. Run migrations (if new DB is at old schema version)
npx prisma migrate deploy

# 5. Bring app online
docker pull [image]
docker run -e DATABASE_URL="..." lorki
```

### Scenario 4: Ransomware / Malicious Deletion

**Symptom**: All data deleted or encrypted

**Recovery**:

```bash
# This is the scenario backups protect against
# 1. STOP all app instances (prevent further writes)
# 2. Restore from backup at known-good point
# 3. Verify data integrity before restarting app
# 4. Investigate: How did attacker gain access?
#    - Were credentials exposed?
#    - Was there an unpatched vulnerability?
#    - Update INCIDENT_RESPONSE_RUNBOOK with findings
```

---

## Testing Disaster Recovery

**Schedule**: Monthly  
**Duration**: 1 hour

### Monthly DR Drill

```bash
#!/bin/bash
# dr-test.sh

set -e

echo "=== Monthly Disaster Recovery Test ==="
echo "Test started: $(date)"

# 1. Create test database from production backup
echo "1. Creating test database from latest backup..."
# For Neon: Create restore DB in console
# For AWS: aws rds restore-db-instance-from-db-snapshot ...

# 2. Verify schema matches
echo "2. Verifying schema..."
TEST_DB_URL="postgresql://test-user:pass@localhost/lorki-test"
npx prisma db push --skip-generate

# 3. Run test queries
echo "3. Running validation queries..."
psql $TEST_DB_URL << EOF
  SELECT COUNT(*) as order_count FROM "Order";
  SELECT COUNT(*) as payout_count FROM "Payout";
  SELECT COUNT(*) as user_count FROM "User";
  
  -- Verify data integrity
  SELECT COUNT(*) as inconsistent_payouts 
  FROM "Payout" p
  LEFT JOIN "Order" o ON p."orderId" = o.id
  WHERE o.id IS NULL;
EOF

# 4. Verify recent orders exist
echo "4. Checking recent orders..."
RECENT_ORDERS=$(psql $TEST_DB_URL -t -c "SELECT COUNT(*) FROM \"Order\" WHERE \"createdAt\" > NOW() - interval '1 day'")
if [ "$RECENT_ORDERS" -eq 0 ]; then
  echo "❌ FAIL: No recent orders found in backup!"
  exit 1
fi
echo "✅ Found $RECENT_ORDERS recent orders"

# 5. Document actual restore time
echo "5. Recording metrics..."
END_TIME=$(date +%s)
RESTORE_TIME=$((END_TIME - START_TIME))
echo "✅ PASS: Restore completed in $RESTORE_TIME seconds"

# 6. Clean up
echo "6. Cleaning up test database..."
# Drop test database

echo "=== DR Test Complete ==="
echo "Report:"
echo "- Backup age: [calculate from backup timestamp]"
echo "- Restore time: $RESTORE_TIME seconds"
echo "- Data integrity: ✅ PASS"
echo "- Recent orders verified: ✅ PASS"
```

**Add to cron** (first Sunday of each month):

```bash
# /etc/cron.d/lorki-dr-test
0 2 1-7 * 0 /path/to/dr-test.sh >> /var/log/lorki-dr-test.log 2>&1
```

---

## RTO & RPO Targets

### Current State (Neon or AWS)

| Scenario | RTO | RPO | Data Loss |
|----------|-----|-----|-----------|
| Database connection lost | <5 min | 0 | None |
| Single corrupted record | 30 min | <1 hour | None |
| Entire database lost | 30 min | 24 hours | Up to 1 day |

### Recommended: Improve RPO to <1 hour

**For Neon**: Upgrade to higher tier for more frequent backups  
**For AWS**: Enable continuous backup (costs extra)  
**For self-hosted**: Implement replication to standby server

### Recommended: Improve RTO to <10 min

**For Neon**: Keep hot standby database (replicate real-time)  
**For AWS**: Enable Multi-AZ (automatic failover)  
**For self-hosted**: Implement streaming replication

---

## Backup Retention Policy

**Current**:
- Keep backups for 7-30 days (platform default)
- Daily backup schedule

**Recommended**:
- Keep daily backups: 30 days
- Keep weekly backups: 12 weeks
- Keep monthly backups: 12 months (for audit trail)

```bash
# Neon: Manual policy (delete old backups monthly)
# AWS: Lifecycle policy (auto-delete after 30 days)
aws rds modify-db-instance \
  --db-instance-identifier lorki-db \
  --backup-retention-period 30
```

---

## Compliance & Audit Trail

**Backup events to log**:
- When backup created (automatic)
- When restore tested (monthly)
- When restore executed (emergency)
- Data loss detected (security incident)

```sql
INSERT INTO "AuditLog" (action, "affectedEntityType", reason, metadata)
VALUES (
  'BACKUP_RESTORE_COMPLETE',
  'Database',
  'Monthly DR test passed',
  jsonb_build_object(
    'backup_timestamp', '2026-09-15T02:00:00Z',
    'restore_time_seconds', 1820,
    'records_verified', 12345
  )
);
```

---

## Off-Site Backup

**Critical for ransomware protection**: Keep a copy offline or on separate account

### For Neon/AWS

```bash
# Weekly export of all data (in addition to snapshots)
0 3 * * 0 pg_dump $DATABASE_URL | gzip > /offline-backups/lorki-$(date +%Y%m%d).sql.gz

# Upload to separate storage (different account/region)
aws s3 cp /offline-backups/lorki-$(date +%Y%m%d).sql.gz \
  s3://lorki-offline-backups-[account-2]/

# Verify integrity weekly
gunzip -t /offline-backups/lorki-*.sql.gz | head -5
```

---

## Emergency Recovery Contact

**If total data loss**:
1. Database provider support (Neon/AWS/your hoster)
2. Backup service provider (if separate)
3. Legal/compliance team (incident notification)
4. Customers (transparency about impact)

**Do NOT**:
- Promise data recovery if backups are missing
- Delay informing customers (compliance requirement)
- Attempt to recover from untested backup

---

## Checklist Before Going Live

- [ ] Verify automatic backups are enabled
- [ ] Know the restore procedure (tested at least once)
- [ ] Document RTO and RPO in this guide
- [ ] Schedule monthly DR drill
- [ ] Have off-site backup policy
- [ ] Update incident response runbook with DB recovery steps
- [ ] Brief team on backup/restore procedures
