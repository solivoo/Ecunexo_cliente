-- Renombra códigos de módulo técnicos a español (dev).
-- invoicing → facturacion, accounting → contabilidad

-- product_modules
UPDATE platform.product_modules SET code = 'facturacion' WHERE code = 'invoicing';
UPDATE platform.product_modules SET code = 'contabilidad' WHERE code = 'accounting';

-- menu_items.module_code
UPDATE platform.menu_items SET module_code = 'facturacion' WHERE module_code = 'invoicing';
UPDATE platform.menu_items SET module_code = 'contabilidad' WHERE module_code = 'accounting';

-- tenants.enabled_modules (jsonb array of strings)
UPDATE tenancy.tenants
SET enabled_modules = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem = '"invoicing"' THEN '"facturacion"'::jsonb
      WHEN elem = '"accounting"' THEN '"contabilidad"'::jsonb
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(enabled_modules, '[]'::jsonb)) AS elem
)
WHERE enabled_modules IS NOT NULL
  AND (
    enabled_modules @> '["invoicing"]'::jsonb
    OR enabled_modules @> '["accounting"]'::jsonb
  );

-- tenants.module_entitlements: array of objects with moduleCode
UPDATE tenancy.tenants
SET module_entitlements = (
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
  FROM jsonb_array_elements(COALESCE(module_entitlements, '[]'::jsonb)) AS ent
)
WHERE module_entitlements IS NOT NULL
  AND (
    module_entitlements::text LIKE '%invoicing%'
    OR module_entitlements::text LIKE '%accounting%'
  );
SELECT 'tenants' AS tabla, name, enabled_modules FROM tenancy.tenants WHERE enabled_modules IS NOT NULL ORDER BY name LIMIT 10;
SELECT code, display_name FROM platform.product_modules WHERE code IN ('facturacion','contabilidad','invoicing','accounting') ORDER BY code;
