const test = require("node:test");
const assert = require("node:assert/strict");

const ActivityLog = require("../../app/models/ActivityLog");
const {
  AUDIT_GROUPS,
  AUDIT_ACTIONS,
  SENSITIVE_ACTION_TYPES,
  actionTypesInGroup,
} = require("../../app/constants/auditActions");

/**
 * constants/auditActions.js is the single list of loggable actions: the model
 * enum, the per-admin timeline labels and the Audit Log page's filters all come
 * from it. These checks keep the catalog itself well-formed, because a broken
 * entry would surface as a filter that silently matches nothing.
 */

test("the ActivityLog enum is exactly the catalog", () => {
  assert.deepEqual(
    [...ActivityLog.schema.path("actionType").enumValues].sort(),
    Object.keys(AUDIT_ACTIONS).sort()
  );
});

test("every action has a label and a known group", () => {
  const groups = new Set(AUDIT_GROUPS.map((g) => g.key));
  const broken = Object.entries(AUDIT_ACTIONS)
    .filter(([, action]) => !action.label || !groups.has(action.group))
    .map(([key]) => key);
  assert.deepEqual(broken, [], `actions with no label or an unknown group: ${broken.join(", ")}`);
});

test("every group has at least one action, and groups partition the catalog", () => {
  const counted = AUDIT_GROUPS.reduce((sum, group) => {
    const members = actionTypesInGroup(group.key);
    assert.ok(members.length > 0, `group "${group.key}" has no actions — its filter would always be empty`);
    return sum + members.length;
  }, 0);
  assert.equal(counted, Object.keys(AUDIT_ACTIONS).length);
});

test("access and fee changes are flagged sensitive", () => {
  for (const key of ["admin_created", "admin_role_changed", "admin_permissions_changed", "admin_status_changed", "admin_password_reset", "settings_updated"]) {
    assert.ok(SENSITIVE_ACTION_TYPES.includes(key), `${key} should be sensitive`);
  }
  assert.ok(!SENSITIVE_ACTION_TYPES.includes("admin_login"), "a sign-in is not a sensitive action");
});
