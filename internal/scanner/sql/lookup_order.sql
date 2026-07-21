SELECT
    o.id,
    o.number,
    o.status,
    o.deleted_at,
    o.race_pack_picked_up_at,
    o.race_pack_picked_up_by,
    p.id AS participant_id,
    p.name AS participant_name,
    p.bib_name,
    p.bib_number,
    p.ukuran_jersey,
    COALESCE(tparent.name, t.name) AS ticket_category,
    (SELECT COUNT(*) FROM participants WHERE order_id = o.id) AS participant_count
FROM orders o
LEFT JOIN participants p ON p.order_id = o.id
LEFT JOIN tickets t ON t.id = o.ticket_id
LEFT JOIN tickets tparent ON tparent.id = t.parent_id
WHERE o.id = $1
  AND o.deleted_at IS NULL