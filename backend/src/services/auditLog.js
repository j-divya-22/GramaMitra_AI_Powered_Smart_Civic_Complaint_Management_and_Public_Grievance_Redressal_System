export const logAuditEvent = async (query, {
  userId = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
}) => {
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, details === null ? null : JSON.stringify(details)]
  );
};
