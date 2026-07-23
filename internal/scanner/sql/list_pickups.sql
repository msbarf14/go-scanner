WITH filtered_pickups AS (
    SELECT
        o.id,
        o.number,
        o.status,
        o.race_pack_picked_up_at,
        p.participant_name,
        p.bib_name,
        p.bib_number,
        p.ukuran_jersey,
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
      AND ($1::text = '' OR o.number ILIKE $1 ESCAPE '\' OR p.participant_name ILIKE $1 ESCAPE '\' OR p.bib_name ILIKE $1 ESCAPE '\' OR p.bib_number ILIKE $1 ESCAPE '\')
      AND ($2::text = '' OR lower(COALESCE(tparent.name, t.name)) = lower($2::text))
      AND ($3::timestamp IS NULL OR o.race_pack_picked_up_at >= $3::timestamp)
      AND ($4::timestamp IS NULL OR o.race_pack_picked_up_at < $4::timestamp)
      AND ($5::timestamp IS NULL OR (o.race_pack_picked_up_at, o.id) < ($5::timestamp, $6::text))
)
SELECT
    id,
    number,
    status,
    race_pack_picked_up_at,
    participant_name,
    bib_name,
    bib_number,
    ukuran_jersey,
    ticket_category,
    picked_up_by_name
FROM filtered_pickups
ORDER BY race_pack_picked_up_at DESC, id DESC
LIMIT $7;
