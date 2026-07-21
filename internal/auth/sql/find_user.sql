SELECT id, COALESCE(name, ''), password
FROM users
WHERE username = $1 OR lower(email) = lower($1)
LIMIT 2;
