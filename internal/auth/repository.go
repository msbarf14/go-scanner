package auth

import (
	"context"
	_ "embed"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const userModelType = "App\\Models\\User"

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) FindUserByIdentity(ctx context.Context, identity string) (User, bool, error) {
	rows, err := r.pool.Query(ctx, findUserSQL, identity)
	if err != nil {
		return User{}, false, fmt.Errorf("find user: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0, 2)
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Name, &user.PasswordHash); err != nil {
			return User{}, false, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return User{}, false, fmt.Errorf("read users: %w", err)
	}
	if len(users) != 1 {
		return User{}, false, nil
	}
	return users[0], true, nil
}

func (r *Repository) IsAuthorized(ctx context.Context, userID string, roles []string, permissions []string) (bool, error) {
	if len(roles) == 0 && len(permissions) == 0 {
		return false, nil
	}

	var allowed bool
	err := r.pool.QueryRow(ctx, isAuthorizedSQL, userID, roles, permissions, userModelType).Scan(&allowed)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("authorize user: %w", err)
	}
	return allowed, nil
}

//go:embed sql/find_user.sql
var findUserSQL string

//go:embed sql/is_authorized.sql
var isAuthorizedSQL string
