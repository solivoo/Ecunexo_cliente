-- licensing_ecunexo: invoicing → facturacion, accounting → contabilidad

UPDATE licensing.plans
SET enabled_module_codes_default = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem = '"invoicing"' THEN '"facturacion"'::jsonb
      WHEN elem = '"accounting"' THEN '"contabilidad"'::jsonb
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(enabled_module_codes_default, '[]'::jsonb)) AS elem
)
WHERE enabled_module_codes_default::text LIKE '%invoicing%'
   OR enabled_module_codes_default::text LIKE '%accounting%';

UPDATE licensing.plans
SET module_entitlements_default = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN ent ? 'moduleCode' THEN
        jsonb_set(
          ent,
          '{moduleCode}',
          to_jsonb(
            CASE ent->>'moduleCode'
              WHEN 'invoicing' THEN 'facturacion'
              WHEN 'accounting' THEN 'contabilidad'
              ELSE ent->>'moduleCode'
            END
          )
        )
      ELSE ent
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(module_entitlements_default, '[]'::jsonb)) AS ent
)
WHERE module_entitlements_default IS NOT NULL
  AND (
    module_entitlements_default::text LIKE '%invoicing%'
    OR module_entitlements_default::text LIKE '%accounting%'
  );

-- Snapshot en grants emitidos (si existe columna similar)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'licensing' AND table_name = 'license_grants'
      AND column_name = 'enabled_module_codes'
  ) THEN
    EXECUTE $u$
      UPDATE licensing.license_grants
      SET enabled_module_codes = (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN elem = '"invoicing"' THEN '"facturacion"'::jsonb
            WHEN elem = '"accounting"' THEN '"contabilidad"'::jsonb
            ELSE elem
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(enabled_module_codes, '[]'::jsonb)) AS elem
      )
      WHERE enabled_module_codes IS NOT NULL
        AND (enabled_module_codes::text LIKE '%invoicing%' OR enabled_module_codes::text LIKE '%accounting%')
    $u$;
  END IF;
END $$;

SELECT code, enabled_module_codes_default FROM licensing.plans ORDER BY code;
