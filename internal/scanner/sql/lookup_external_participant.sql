SELECT
    ep.id,
    ep.name,
    ep.bib_name,
    ep.bib_number,
    ep.race_pack_picked_up_at,
    ep.race_pack_picked_up_by,
    t.name AS ticket_category
FROM external_participants ep
LEFT JOIN tickets t ON t.id = ep.category_ticket_id
WHERE ep.id = $1
  AND ep.deleted_at IS NULL
