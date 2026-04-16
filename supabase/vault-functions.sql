-- Conjure: Supabase Vault public wrapper functions
-- Run once in the Supabase Dashboard SQL editor after enabling the Vault extension.
-- These expose pgsodium Vault operations as public RPCs callable by the service role.
--
-- Prerequisites:
--   1. Supabase Vault extension must be enabled (Dashboard → Database → Extensions → vault)
--   2. Run this after rls.sql

-- vault_create_secret: stores a new secret and returns its UUID
CREATE OR REPLACE FUNCTION public.vault_create_secret(new_secret text, new_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
BEGIN
  SELECT vault.create_secret(new_secret, new_name) INTO secret_id;
  RETURN secret_id;
END;
$$;

-- vault_read_secret: decrypts and returns a secret by UUID
CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN secret_value;
END;
$$;

-- vault_update_secret: replaces the encrypted value of an existing secret
CREATE OR REPLACE FUNCTION public.vault_update_secret(secret_id uuid, new_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  PERFORM vault.update_secret(secret_id, new_secret);
END;
$$;

-- vault_delete_secret: permanently removes a secret from Vault
CREATE OR REPLACE FUNCTION public.vault_delete_secret(secret_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
END;
$$;
