-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_EMAIL', 'ACTIVE', 'TOTP_REENROLLMENT_REQUIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "EmailActionType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMINISTRATOR', 'ANONYMOUS', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "age_declared" BOOLEAN NOT NULL,
    "email_verified_at" TIMESTAMPTZ(6),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_EMAIL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(128),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_credentials" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "digest" VARCHAR(128) NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by" UUID,

    CONSTRAINT "refresh_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_action_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "EmailActionType" NOT NULL,
    "digest" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_ciphertext" TEXT NOT NULL,
    "key_version" VARCHAR(64) NOT NULL,
    "enabled_at" TIMESTAMPTZ(6),
    "last_accepted_totp_step" BIGINT,

    CONSTRAINT "totp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "totp_recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "digest" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "totp_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_type" "AuditActorType" NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(64),
    "device" VARCHAR(512),
    "target_type" VARCHAR(64),
    "target_id" VARCHAR(128),
    "metadata" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_credentials_digest_key" ON "refresh_credentials"("digest");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_credentials_jti_key" ON "refresh_credentials"("jti");

-- CreateIndex
CREATE INDEX "refresh_credentials_session_id_expires_at_idx" ON "refresh_credentials"("session_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_action_tokens_digest_key" ON "email_action_tokens"("digest");

-- CreateIndex
CREATE INDEX "email_action_tokens_user_id_type_expires_at_idx" ON "email_action_tokens"("user_id", "type", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "totp_credentials_user_id_key" ON "totp_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "totp_recovery_codes_digest_key" ON "totp_recovery_codes"("digest");

-- CreateIndex
CREATE INDEX "totp_recovery_codes_user_id_consumed_at_idx" ON "totp_recovery_codes"("user_id", "consumed_at");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_occurred_at_idx" ON "audit_events"("actor_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_credentials" ADD CONSTRAINT "refresh_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_action_tokens" ADD CONSTRAINT "email_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_credentials" ADD CONSTRAINT "totp_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "totp_recovery_codes" ADD CONSTRAINT "totp_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Privilege groups are separate from the credentials used by the API and deployment tooling.
DO $$ BEGIN CREATE ROLE auth_migrator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE auth_runtime NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE auth_maintenance NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "roles" ("id", "name") VALUES
  ('00000000-0000-4000-8000-000000000001', 'apostador'),
  ('00000000-0000-4000-8000-000000000002', 'operador'),
  ('00000000-0000-4000-8000-000000000003', 'administrador');

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO auth_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_events" FROM auth_runtime;
GRANT SELECT, INSERT ON TABLE "audit_events" TO auth_runtime;
GRANT SELECT, DELETE ON TABLE "audit_events" TO auth_maintenance;
GRANT USAGE ON SCHEMA public TO auth_runtime, auth_maintenance;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_runtime;

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND pg_has_role(current_user, 'auth_maintenance', 'member')
    AND OLD."occurred_at" < CURRENT_TIMESTAMP - INTERVAL '1 year' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit events are append-only';
END;
$$;

CREATE TRIGGER audit_events_no_update_or_delete
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
