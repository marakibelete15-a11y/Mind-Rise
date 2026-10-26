-- =============================================================================
-- Migration: Harden Moderation History & Encrypted Verified Identity (SRS v1.3)
-- =============================================================================

-- Drop old check constraint and partial indexes on verified_identities
ALTER TABLE "verified_identities" DROP CONSTRAINT IF EXISTS "check_phone_or_email_required";
DROP INDEX IF EXISTS "idx_unique_verified_phone";
DROP INDEX IF EXISTS "idx_unique_verified_email";

-- DropForeignKey
ALTER TABLE "auto_restrictions" DROP CONSTRAINT IF EXISTS "auto_restrictions_userId_fkey";
ALTER TABLE "crisis_flags" DROP CONSTRAINT IF EXISTS "crisis_flags_userId_fkey";
ALTER TABLE "moderation_actions" DROP CONSTRAINT IF EXISTS "moderation_actions_targetUserId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "verified_identities_email_idx";
DROP INDEX IF EXISTS "verified_identities_phone_idx";

-- AlterTable
ALTER TABLE "auto_restrictions" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "crisis_flags" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "moderation_actions" ADD COLUMN IF NOT EXISTS "targetHandleSnapshot" TEXT,
ALTER COLUMN "targetUserId" DROP NOT NULL;

-- AlterTable: Add new encrypted & hash columns first
ALTER TABLE "verified_identities"
ADD COLUMN IF NOT EXISTS "emailEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "emailHash" TEXT,
ADD COLUMN IF NOT EXISTS "phoneEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "phoneHash" TEXT;

-- Data migration: backfill existing records if present before dropping legacy columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verified_identities' AND column_name = 'phone') THEN
    EXECUTE 'UPDATE "verified_identities" SET "phoneEncrypted" = COALESCE("phoneEncrypted", "phone") WHERE "phone" IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'verified_identities' AND column_name = 'email') THEN
    EXECUTE 'UPDATE "verified_identities" SET "emailEncrypted" = COALESCE("emailEncrypted", "email") WHERE "email" IS NOT NULL';
  END IF;
END $$;

-- Drop legacy plaintext columns
ALTER TABLE "verified_identities"
DROP COLUMN IF EXISTS "email",
DROP COLUMN IF EXISTS "phone";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "verified_identities_phoneHash_idx" ON "verified_identities"("phoneHash");
CREATE INDEX IF NOT EXISTS "verified_identities_emailHash_idx" ON "verified_identities"("emailHash");

-- AddForeignKey (SetNull ensures moderation history survives account deletion per SRS FR-7.3)
ALTER TABLE "crisis_flags" ADD CONSTRAINT "crisis_flags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (SetNull preserves moderation action audit log)
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (SetNull preserves restriction tracking history)
ALTER TABLE "auto_restrictions" ADD CONSTRAINT "auto_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- CUSTOM CONSTRAINTS & ADVANCED INDEXES
-- =============================================================================

-- 1. Ensure VerifiedIdentity has at least one contact method
ALTER TABLE "verified_identities"
ADD CONSTRAINT "check_phone_or_email_required"
CHECK ("phoneEncrypted" IS NOT NULL OR "emailEncrypted" IS NOT NULL);

-- 2. Enforce FR-1.5: One active account per verified phone/email (HMAC blind index)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_verified_phone_hash"
ON "verified_identities" ("phoneHash")
WHERE "phoneHash" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_verified_email_hash"
ON "verified_identities" ("emailHash")
WHERE "emailHash" IS NOT NULL;
