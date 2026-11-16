-- Apply with the migration/owner credential only. This source is intentionally
-- not executed as part of the implementation task.
REVOKE ALL PRIVILEGES ON TABLE "audit_events" FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_events" FROM auth_runtime;
GRANT SELECT, INSERT ON TABLE "audit_events" TO auth_runtime;

REVOKE INSERT, UPDATE, TRUNCATE ON TABLE "audit_events" FROM auth_maintenance;
GRANT SELECT, DELETE ON TABLE "audit_events" TO auth_maintenance;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger
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

DROP TRIGGER IF EXISTS audit_events_no_update_or_delete ON "audit_events";
CREATE TRIGGER audit_events_no_update_or_delete
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
