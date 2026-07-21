SELECT
    o.id,
    o.status,
    o.deleted_at,
    o.race_pack_picked_up_at,
    o.race_pack_picked_up_by,
    (SELECT COUNT(*) FROM participants WHERE order_id = o.id) AS participant_count
FROM orders o
WHERE o.id = $1