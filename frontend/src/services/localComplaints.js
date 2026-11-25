const STORAGE_KEY = 'janvani_local_complaints_v1';
const VALID_STATUSES = ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'];

const readComplaints = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const complaints = JSON.parse(stored);
    if (!Array.isArray(complaints)) throw new Error('Expected complaint data to be a list.');
    return complaints;
  } catch {
    throw new Error('Local demo complaint data is invalid. Clear this site’s data to reset it.');
  }
};

const saveComplaints = (complaints) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
  } catch {
    throw new Error('Unable to save this demo report in browser storage. Try fewer or smaller photos.');
  }
};

const makeTimelineEntry = ({ status, message, actorName, actorRole }) => ({
  id: crypto.randomUUID(),
  status,
  message,
  actorName,
  actorRole,
  createdAt: new Date().toISOString(),
});

export const getLocalComplaints = () => readComplaints();

export const getMyLocalComplaints = (citizenId) => readComplaints()
  .filter((complaint) => complaint.citizenId === citizenId)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const getLocalComplaint = (id, citizenId) => readComplaints().find((complaint) => (
  complaint.id === id && (!citizenId || complaint.citizenId === citizenId)
)) || null;

export const createLocalComplaint = ({
  citizenId,
  citizenName,
  category,
  description,
  englishDescription = description,
  locationAddress,
  latitude,
  longitude,
  evidenceFiles,
}) => {
  const now = new Date().toISOString();
  const complaint = {
    id: crypto.randomUUID(),
    referenceNumber: `JNV-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    citizenId,
    citizenName,
    category,
    description,
    englishDescription,
    locationAddress,
    latitude,
    longitude,
    evidenceFiles,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    timeline: [
      makeTimelineEntry({
        status: 'pending',
        message: 'Your report has been received and is waiting for staff review.',
        actorName: 'Gramamitra',
        actorRole: 'system',
      }),
    ],
    messages: [],
  };

  const complaints = readComplaints();
  complaints.unshift(complaint);
  saveComplaints(complaints);
  return complaint;
};

const updateComplaint = (id, updater) => {
  const complaints = readComplaints();
  const index = complaints.findIndex((complaint) => complaint.id === id);
  if (index === -1) throw new Error('This local demo complaint could not be found.');

  complaints[index] = updater(complaints[index]);
  saveComplaints(complaints);
  return complaints[index];
};

export const addLocalComplaintMessage = (id, { authorId, authorName, authorRole, message }) => {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || text.length > 1000) throw new Error('Write a message of 1 to 1000 characters.');
  if (!['citizen', 'staff'].includes(authorRole)) throw new Error('This message role is not supported.');

  return updateComplaint(id, (complaint) => ({
    ...complaint,
    updatedAt: new Date().toISOString(),
    messages: [
      ...complaint.messages,
      {
        id: crypto.randomUUID(),
        authorId,
        authorName,
        authorRole,
        message: text,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
};

export const addLocalProgressUpdate = (id, { status, message, actorName }) => {
  if (!VALID_STATUSES.includes(status)) throw new Error('Choose a valid complaint status.');
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || text.length > 1000) throw new Error('Add a progress note of 1 to 1000 characters.');

  return updateComplaint(id, (complaint) => ({
    ...complaint,
    status,
    updatedAt: new Date().toISOString(),
    timeline: [
      ...complaint.timeline,
      makeTimelineEntry({
        status,
        message: text,
        actorName,
        actorRole: 'staff',
      }),
    ],
  }));
};
