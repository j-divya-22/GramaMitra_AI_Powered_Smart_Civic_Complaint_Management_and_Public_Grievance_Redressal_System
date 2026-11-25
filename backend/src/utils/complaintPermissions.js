export const isCitizenComplaintEditable = ({
  status,
  assigned_admin_id: assignedAdminId,
  has_status_history: hasStatusHistory,
  has_progress_updates: hasProgressUpdates,
}) => (
  ['pending', 'Submitted', 'submitted'].includes(status)
  && assignedAdminId === null
  && ![true, 1, '1'].includes(hasStatusHistory)
  && ![true, 1, '1'].includes(hasProgressUpdates)
);
