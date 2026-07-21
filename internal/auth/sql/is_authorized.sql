SELECT EXISTS (
    SELECT 1
    FROM model_has_roles mhr
    JOIN roles r ON r.id = mhr.role_id
    WHERE mhr.model_id = $1
      AND mhr.model_type = $4
      AND r.guard_name = 'web'
      AND r.name = ANY($2::text[])

    UNION ALL

    SELECT 1
    FROM model_has_permissions mhp
    JOIN permissions p ON p.id = mhp.permission_id
    WHERE mhp.model_id = $1
      AND mhp.model_type = $4
      AND p.guard_name = 'web'
      AND p.name = ANY($3::text[])

    UNION ALL

    SELECT 1
    FROM model_has_roles mhr
    JOIN role_has_permissions rhp ON rhp.role_id = mhr.role_id
    JOIN permissions p ON p.id = rhp.permission_id
    WHERE mhr.model_id = $1
      AND mhr.model_type = $4
      AND p.guard_name = 'web'
      AND p.name = ANY($3::text[])
) AS allowed;
