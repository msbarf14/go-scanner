SELECT ep.id
FROM external_participants ep
WHERE ep.deleted_at IS NULL
  AND ep.bib_number_normalized = $1
LIMIT 2
