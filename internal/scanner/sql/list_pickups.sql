WITH pickups AS (
    SELECT
        'order'::text AS target_type,
        o.id AS target_id,
        o.number AS order_number,
        o.status AS order_status,
        o.race_pack_picked_up_at AS picked_up_at,
        p.participant_name,
        p.bib_name,
        p.bib_number,
        p.ukuran_jersey AS jersey_size,
        COALESCE(tparent.name, t.name) AS ticket_category,
        picked_by.name AS picked_up_by_name
    FROM orders AS o
    JOIN LATERAL (
        SELECT
            COUNT(*)::int AS participant_count,
            MAX(participants.name) AS participant_name,
            MAX(participants.bib_name) AS bib_name,
            MAX(participants.bib_number) AS bib_number,
            MAX(participants.ukuran_jersey) AS ukuran_jersey
        FROM participants
        WHERE participants.order_id = o.id
    ) AS p ON p.participant_count = 1
    LEFT JOIN tickets AS t ON t.id = o.ticket_id
    LEFT JOIN tickets AS tparent ON tparent.id = t.parent_id
    LEFT JOIN users AS picked_by ON picked_by.id = o.race_pack_picked_up_by
    WHERE o.deleted_at IS NULL
      AND o.race_pack_picked_up_at IS NOT NULL

    UNION ALL

    SELECT
        'external_participant'::text AS target_type,
        ep.id AS target_id,
        NULL::varchar AS order_number,
        NULL::varchar AS order_status,
        ep.race_pack_picked_up_at AS picked_up_at,
        ep.name AS participant_name,
        ep.bib_name,
        ep.bib_number,
        NULL::varchar AS jersey_size,
        t.name AS ticket_category,
        picked_by.name AS picked_up_by_name
    FROM external_participants AS ep
    LEFT JOIN tickets AS t ON t.id = ep.category_ticket_id
    LEFT JOIN users AS picked_by ON picked_by.id = ep.race_pack_picked_up_by
    WHERE ep.deleted_at IS NULL
      AND ep.race_pack_picked_up_at IS NOT NULL
)
SELECT
    target_type,
    target_id,
    order_number,
    order_status,
    picked_up_at,
    participant_name,
    bib_name,
    bib_number,
    jersey_size,
    ticket_category,
    picked_up_by_name
FROM pickups
WHERE ($1::text = '' OR order_number ILIKE $1 ESCAPE '\' OR participant_name ILIKE $1 ESCAPE '\' OR bib_name ILIKE $1 ESCAPE '\' OR bib_number ILIKE $1 ESCAPE '\')
  AND ($2::text = '' OR lower(ticket_category) = lower($2::text))
  AND ($3::timestamp IS NULL OR picked_up_at >= $3::timestamp)
  AND ($4::timestamp IS NULL OR picked_up_at < $4::timestamp)
  AND ($5::timestamp IS NULL OR (picked_up_at, target_type, target_id) < ($5::timestamp, $6::text, $7::text))
ORDER BY picked_up_at DESC, target_type DESC, target_id DESC
LIMIT $8;
