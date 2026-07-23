SELECT DISTINCT o.id
FROM orders o
WHERE o.deleted_at IS NULL
  AND o.number LIKE '%/%'
  AND UPPER(split_part(o.number, '/', array_length(string_to_array(o.number, '/'), 1))) = $1
LIMIT 2
