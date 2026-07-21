UPDATE orders AS o
SET
    race_pack_picked_up_at = CURRENT_TIMESTAMP,
    race_pack_picked_up_by = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE o.id = $2
  AND o.status = 'paid'
  AND o.deleted_at IS NULL
  AND o.race_pack_picked_up_at IS NULL
  AND (
      SELECT COUNT(*)
      FROM participants AS p
      WHERE p.order_id = o.id
  ) = 1
RETURNING
    o.id,
    o.race_pack_picked_up_at,
    o.race_pack_picked_up_by