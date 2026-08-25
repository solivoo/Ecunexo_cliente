-- Dev: asegura contabilidad en tenants con facturación.
UPDATE tenancy.tenants
SET enabled_modules = enabled_modules || '["contabilidad"]'::jsonb
WHERE enabled_modules IS NOT NULL
  AND enabled_modules @> '["facturacion"]'::jsonb
  AND NOT (enabled_modules @> '["contabilidad"]'::jsonb);

SELECT name, display_name, enabled_modules
FROM tenancy.tenants
WHERE enabled_modules @> '["contabilidad"]'::jsonb
ORDER BY name;
