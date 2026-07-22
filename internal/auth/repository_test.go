package auth

import (
	"strings"
	"testing"
)

func TestInheritedPermissionRequiresWebRoleGuard(t *testing.T) {
	inheritedBranch := isAuthorizedSQL[strings.LastIndex(isAuthorizedSQL, "FROM model_has_roles"):]

	if !strings.Contains(inheritedBranch, "JOIN roles r ON r.id = mhr.role_id") {
		t.Fatal("inherited permission branch must join roles")
	}
	if !strings.Contains(inheritedBranch, "r.guard_name = 'web'") {
		t.Fatal("inherited permission branch must require web role guard")
	}
	if !strings.Contains(inheritedBranch, "p.guard_name = 'web'") {
		t.Fatal("inherited permission branch must require web permission guard")
	}
}
