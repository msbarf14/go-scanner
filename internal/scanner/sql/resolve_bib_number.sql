SELECT DISTINCT o.id
FROM orders o
JOIN participants p ON p.order_id = o.id
WHERE o.deleted_at IS NULL
  AND UPPER(TRIM(p.bib_number)) = $1
LIMIT 2
