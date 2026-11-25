import fetch from 'node-fetch';
import { randomUUID } from 'node:crypto';
import { query } from '../config/db.js';
import { formatComplaintRewardFacts, getAdminChatFacts } from './adminChatData.js';

const isCompleteStatus = (status) => (
  String(status || '').toLowerCase() === 'resolved'
);

const isPendingStatus = (status) => (
  ['pending', 'submitted'].includes(String(status || '').toLowerCase())
);

const isInProgressStatus = (status) => (
  ['assigned', 'in_progress'].includes(String(status || '').toLowerCase())
);

const normalizeCategory = (category) => (
  typeof category === 'string' && category.trim() ? category.trim() : 'other'
);

const formatCategory = (category) => normalizeCategory(category)
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getCitizenPromptFacts = (facts, message) => {
  const question = message.toLowerCase();
  const complaints = facts.complaints;
  const categoryCounts = complaints.reduce((counts, complaint) => {
    const category = normalizeCategory(complaint.category);
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const asksForProgress = /\b(progress|updates?|actions?|status)\b/.test(question);
  const asksForCategory = /\bcategor(?:y|ies)\b/.test(question);
  const asksForAll = /\b(all|every|each|list|show|describe)\b/.test(question)
    || /\bwhich\b.*\bcomplaints?\b/.test(question);
  const asksForPendingDetails = /\b(which|what|list|show)\b.*\bpending\b/.test(question);
  const asksForLatest = /\b(latest|most recent|recently submitted)\b/.test(question);

  let relevantComplaints = [];
  if (asksForProgress || asksForAll) {
    relevantComplaints = complaints;
  }
  if (asksForPendingDetails && !asksForProgress) {
    relevantComplaints = complaints.filter((complaint) => isPendingStatus(complaint.status));
  } else if (asksForLatest) {
    relevantComplaints = complaints.slice(0, 1);
  }

  return {
    summary: facts.summary,
    ...(asksForCategory ? { category_counts: categoryCounts } : {}),
    ...(relevantComplaints.length ? { complaints: relevantComplaints } : {}),
  };
};

const getAdminPromptFacts = (facts, message) => {
  const question = message.toLowerCase();
  const asksForCategory = /\bcategor(?:y|ies)\b/.test(question);
  const asksForCitizens = /\bcitizen|each citizen|most complaints\b/.test(question);
  const asksForStatus = /\b(status|pending|resolved|in progress)\b/.test(question);
  const asksForWaiting = /\b(waiting|action)\b/.test(question)
    || /\b(which|what|list|show)\b.*\bpending\b/.test(question);
  const asksForRecent = /\b(recent|recently|last 30 days|this month)\b/.test(question);
  const asksForCnn = /\b(cnn|prediction|confidence)\b/.test(question);

  return {
    summary: facts.summary,
    ...(asksForCategory ? { categories: facts.categories } : {}),
    ...(asksForCitizens ? { complaints_by_citizen: facts.complaints_by_citizen } : {}),
    ...(asksForWaiting ? { waiting_for_action: facts.waiting_for_action } : {}),
    ...(asksForStatus ? { statuses: facts.statuses } : {}),
    ...(asksForRecent ? { submitted_in_last_30_days: facts.submitted_in_last_30_days } : {}),
    ...(asksForCnn ? { cnn: facts.cnn } : {}),
  };
};

const groupByCategory = (complaints) => complaints.reduce((groups, complaint) => {
  const category = normalizeCategory(complaint.category);
  groups[category] = groups[category] || [];
  groups[category].push(complaint);
  return groups;
}, {});

const formatCitizenRecords = (complaints, includeProgress) => Object.entries(groupByCategory(complaints))
  .map(([category, records]) => [
    `### ${formatCategory(category)}`,
    ...records.flatMap((complaint) => {
      const description = complaint.description || 'Description not recorded';
      const lines = [
        `- **${complaint.complaint_number}**: ${description}`,
        `  - Status: ${complaint.status || 'Not recorded'}`,
      ];
      if (includeProgress) {
        if (complaint.progress_percentage === null || complaint.progress_percentage === undefined) {
          lines.push('  - Progress: No progress update recorded; percentage and stage are unavailable.');
        } else {
          lines.push(`  - Progress: ${complaint.progress_percentage}%${complaint.latest_stage ? ` (${complaint.latest_stage})` : ''}.`);
          if (complaint.latest_progress_update) {
            lines.push(`  - Latest update: ${complaint.latest_progress_update}`);
          }
        }
      }
      return lines;
    }),
  ].join('\n'))
  .join('\n\n');

export const buildStructuredSupplement = ({ role, message, complaint, facts }) => {
  const question = message.toLowerCase();
  if (role === 'citizen' && complaint) {
    const lines = [];
    if (/\b(location|where|coordinates?|latitude|longitude)\b/.test(question)) {
      const hasCoordinates = complaint.latitude !== null && complaint.latitude !== undefined
        && complaint.longitude !== null && complaint.longitude !== undefined;
      const location = [
        complaint.address ? `Address: ${complaint.address}` : '',
        hasCoordinates ? `Coordinates: (${complaint.latitude}, ${complaint.longitude})` : '',
      ].filter(Boolean);
      lines.push(`- Location: ${location.length ? location.join('; ') : 'Not recorded.'}`);
    }
    if (/\b(status|stage)\b/.test(question)) {
      lines.push(`- Current status: ${complaint.status || 'Not recorded.'}`);
      if (/\bstage\b/.test(question)) {
        lines.push(`- Progress stage: ${complaint.progress_updates?.length
          ? complaint.progress_updates[complaint.progress_updates.length - 1].stage
          : 'No progress update recorded.'}`);
      }
    }
    if (/\b(progress|updates?|actions?)\b/.test(question)) {
      if (!complaint.progress_updates?.length) {
        lines.push('- Progress: No progress update recorded; no percentage or stage is available.');
      } else {
        lines.push(...complaint.progress_updates.map((update) => (
          `- Progress: ${update.progress_percentage}% (${update.stage}) — ${update.remarks}`
        )));
      }
    }
    if (/\b(issue|reported|description)\b/.test(question)) {
      lines.push(`- Reported issue: ${complaint.english_text || complaint.original_text || complaint.generated_description || 'Description not recorded.'}`);
    }
    return lines.length ? lines.join('\n') : null;
  }

  if (role === 'citizen' && facts) {
    const asksProgress = /\b(progress|updates?|actions?)\b/.test(question);
    const asksPendingDetails = /\b(which|what|list|show)\b.*\bpending\b/.test(question);
    const asksAll = /\b(all|every|each|list|show)\b/.test(question)
      && /\b(complaints?|reports?)\b/.test(question);
    const asksLatest = /\b(latest|most recent|recently submitted)\b/.test(question);
    const asksCategories = /\bcategor(?:y|ies)\b/.test(question);

    if (asksProgress || asksPendingDetails || asksAll || asksLatest) {
      let records = facts.complaints;
      if (asksPendingDetails && !asksProgress) {
        records = records.filter((record) => isPendingStatus(record.status));
      } else if (asksLatest) {
        records = records.slice(0, 1);
      }
      if (!records.length) {
        return `You have ${facts.summary.total} complaints. No matching complaint records were found.`;
      }
      const heading = `You have ${facts.summary.total} complaints.`;
      return `${heading}\n\n${formatCitizenRecords(records, asksProgress)}`;
    }

    if (asksCategories) {
      const counts = facts.complaints.reduce((result, record) => {
        const category = normalizeCategory(record.category);
        result[category] = (result[category] || 0) + 1;
        return result;
      }, {});
      return `Category breakdown (${facts.summary.total} complaints):\n${Object.entries(counts)
        .map(([category, count]) => `- ${formatCategory(category)}: ${count}`)
        .join('\n')}`;
    }
  }

  if (role === 'admin' && facts) {
    if (facts.structuredResponse) return facts.structuredResponse;
    const parts = [];
    const asksOverall = /\b(overall|summari[sz]e|situation)\b/.test(question);
    const asksCounts = /\b(how many|total|count|number)\b/.test(question)
      && /\bcomplaints?\b/.test(question);
    const asksStatus = /\b(pending|submitted|resolved|in progress|status)\b/.test(question);
    if (asksOverall || asksCounts || asksStatus) {
      parts.push(
        `Complaint totals: ${facts.summary.total}; pending/submitted: ${facts.summary.pending}; `
        + `in progress: ${facts.summary.in_progress}; resolved: ${facts.summary.resolved}.`
      );
    }

    if (/\bcategor(?:y|ies)\b/.test(question)) {
      const rows = facts.categories;
      parts.push(`Complaints by category:\n${rows.map((row) => `- ${formatCategory(row.category)}: ${row.count}`).join('\n')}`);
      if (/\b(highest|most|top)\b/.test(question) && rows.length) {
        const highest = Number(rows[0].count);
        const leaders = rows.filter((row) => Number(row.count) === highest).map((row) => formatCategory(row.category));
        parts.push(`Highest category: ${leaders.join(', ')} (${highest}).`);
      }
    }

    if (/\bcitizen|each citizen|most complaints\b/.test(question)) {
      const rows = facts.complaints_by_citizen;
      parts.push(`Citizen complaint counts (total ${facts.summary.total} complaints):\n${
        rows.length
          ? rows.map((row) => `- ${row.citizen_name}: ${row.complaint_count}`).join('\n')
          : 'No citizen complaint records were found.'
      }`);
      if (/\bmost\b/.test(question) && rows.length) {
        const highest = Number(rows[0].complaint_count);
        const leaders = rows.filter((row) => Number(row.complaint_count) === highest).map((row) => row.citizen_name);
        parts.push(`Most complaints: ${leaders.join(', ')} (${highest}).`);
      }
    }

    if (/\b(waiting|action)\b/.test(question) || /\b(which|what|list|show)\b.*\bpending\b/.test(question)) {
      const rows = facts.waiting_for_action;
      parts.push(`Complaints waiting for action (${rows.length} pending/submitted):\n${
        rows.length
          ? rows.map((row) => `- ${row.complaint_number} — ${row.citizen_name}, ${row.category || 'other'}; ${row.status}; ${row.description}`).join('\n')
          : 'None.'
      }`);
    }

    if (/\b(recent|recently|last 30 days|this month)\b/.test(question)) {
      parts.push(`Complaints submitted in the last 30 days: ${facts.submitted_in_last_30_days}.`);
    }
    if (/\b(cnn|prediction|confidence)\b/.test(question)) {
      parts.push(`CNN records:\n${facts.cnn.length
        ? facts.cnn.map((row) => `- ${row.complaint_number}: ${row.cnn_category}, confidence ${row.cnn_confidence}`).join('\n')
        : 'No CNN prediction records are available.'}`);
    }
    return parts.length ? parts.join('\n\n') : null;
  }

  if (role === 'admin' && complaint) {
    const lines = [];
    if (/\b(who|citizen|submitted|submitter|name|user id)\b/.test(question)) {
      lines.push(`- Submitted by: ${complaint.citizen_name || 'Citizen name unavailable.'}`);
      lines.push(`- Citizen user ID: ${complaint.citizen_id ?? 'Unavailable.'}`);
    }
    if (/\b(when|date|time|submitted|submission)\b/.test(question)) {
      lines.push(`- Submitted on: ${complaint.created_at || 'Submission date and time unavailable.'}`);
    }
    if (/\b(category|type of complaint)\b/.test(question)) {
      lines.push(`- Category: ${complaint.category || 'Not recorded.'}`);
    }
    if (/\b(location|where|coordinates?|latitude|longitude)\b/.test(question)) {
      const hasCoordinates = complaint.latitude !== null && complaint.latitude !== undefined
        && complaint.longitude !== null && complaint.longitude !== undefined;
      const location = [
        complaint.address ? `Address: ${complaint.address}` : '',
        hasCoordinates ? `Coordinates: (${complaint.latitude}, ${complaint.longitude})` : '',
      ].filter(Boolean);
      lines.push(`- Location: ${location.length ? location.join('; ') : 'Not recorded.'}`);
    }
    if (/\b(status|stage)\b/.test(question)) {
      lines.push(`- Current status: ${complaint.status || 'Not recorded.'}`);
    }
    if (/\b(progress|updates?|actions?|stage|history)\b/.test(question)) {
      if (complaint.progress_updates?.length) {
        lines.push(...complaint.progress_updates.map((update) => (
          `- Progress update: ${update.stage}, ${update.progress_percentage}% — ${update.remarks}`
        )));
      } else {
        lines.push('- Progress: No progress update recorded; percentage and stage are unavailable.');
      }
      if (complaint.status_updates?.length) {
        lines.push(...complaint.status_updates.map((update) => (
          `- Status action: ${update.old_status || 'Not recorded'} → ${update.new_status}`
          + `${update.reason ? ` — ${update.reason}` : ''}`
        )));
      } else {
        lines.push('- Status action history: No recorded status actions.');
      }
    }
    if (/\b(officer|assigned|assignment)\b/.test(question)) {
      lines.push(`- Assigned administrator: ${complaint.assigned_admin_name || 'Not assigned.'}`);
      if (/\bofficer\b/.test(question)) {
        lines.push('- Officer assignment: Not recorded in the complaint data.');
      }
    }
    if (/\b(issue|reported|description)\b/.test(question)) {
      lines.push(`- Reported issue: ${complaint.english_text || complaint.original_text || complaint.generated_description || 'Description not recorded.'}`);
    }
    if (/\b(reward|points?|earned|eligible|eligibility|paid|waiting|six months|six-month)\b/.test(question)) {
      lines.push(`- ${formatComplaintRewardFacts(complaint, complaint.reward_transactions || [])}`);
    }
    if (/\b(cnn|prediction|confidence)\b/.test(question)) {
      lines.push(...(complaint.images || []).map((image) => (
        `- CNN record: ${image.cnn_category || 'Not recorded'}`
        + `${image.cnn_confidence !== null ? `, confidence ${image.cnn_confidence}` : ''}`
      )));
    }
    return lines.length ? lines.join('\n') : null;
  }

  return null;
};

const getGenerationLimit = ({ role, message, complaint, facts, hasStructuredSupplement }) => {
  if (hasStructuredSupplement) return 128;
  const question = message.toLowerCase();
  const exhaustiveRequest = /\b(all|each|every|list|show|which|progress|updates?|waiting|pending|citizens|categories)\b/.test(question);
  if (exhaustiveRequest) return 1024;

  let recordCount = 0;
  if (complaint) {
    recordCount = (complaint.progress_updates?.length || 0) + (complaint.status_updates?.length || 0);
  } else if (role === 'citizen') {
    const relevantFacts = getCitizenPromptFacts(facts, message);
    recordCount = relevantFacts.complaints?.length || 0;
    recordCount += Object.keys(relevantFacts.category_counts || {}).length;
  } else {
    const relevantFacts = getAdminPromptFacts(facts, message);
    recordCount = relevantFacts.categories?.length || 0;
    recordCount += relevantFacts.complaints_by_citizen?.length || 0;
    if (relevantFacts.waiting_for_action) {
      recordCount += relevantFacts.waiting_for_action.length;
    }
  }

  const detailRequested = /\b(all|each|every|list|show|progress|updates?|complaints?|categories|citizens|waiting|pending)\b/.test(question);
  return Math.min(1024, Math.max(detailRequested ? 320 : 192, 192 + recordCount * 64));
};

export const getComplaintWithProgress = async (
  complaintId,
  { citizenId = null, includeAdminDetails = false, runQuery = query } = {}
) => {
  const ownershipClause = citizenId === null ? '' : ' AND c.citizen_id = ?';
  const adminFields = includeAdminDetails
    ? ', c.citizen_id, submitter.full_name AS citizen_name, c.assigned_admin_id, assigned.full_name AS assigned_admin_name'
    : '';
  const complaintResult = await runQuery(
    `SELECT c.id, c.complaint_number, c.category, c.original_text, c.english_text,
            c.generated_title, c.generated_description, c.status, c.address,
            c.latitude, c.longitude, c.created_at, c.updated_at, c.resolved_at
            ${adminFields}
     FROM complaints c
     ${includeAdminDetails ? 'LEFT JOIN users assigned ON assigned.id = c.assigned_admin_id LEFT JOIN users submitter ON submitter.id = c.citizen_id AND submitter.role = \'citizen\'' : ''}
     WHERE c.id = ?${ownershipClause}`,
    citizenId === null ? [complaintId] : [complaintId, citizenId]
  );
  if (complaintResult.rows.length === 0) return null;

  const complaint = complaintResult.rows[0];
  const queries = [
    runQuery(
      `SELECT stage, progress_percentage, remarks, created_at
       FROM complaint_progress_updates
       WHERE complaint_id = ?
       ORDER BY created_at ASC, id ASC`,
      [complaintId]
    ),
  ];
  if (includeAdminDetails) {
    queries.push(runQuery(
      `SELECT h.old_status, h.new_status, h.reason, h.created_at,
              admin.full_name AS admin_name
       FROM complaint_status_history h
       LEFT JOIN users admin ON admin.id = h.admin_id
       WHERE h.complaint_id = ?
       ORDER BY h.created_at ASC, h.id ASC`,
      [complaintId]
    ));
    queries.push(runQuery(
      `SELECT cnn_category, cnn_confidence, created_at
       FROM complaint_images
       WHERE complaint_id = ?
       ORDER BY created_at ASC, id ASC`,
      [complaintId]
    ));
    queries.push(runQuery(
      `SELECT transaction_type, points, amount, earned_at, eligibility_date,
              CASE WHEN eligibility_date <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS is_eligible
       FROM reward_transactions
       WHERE complaint_id = ?
         AND COALESCE(citizen_id, user_id) = ?
         AND transaction_type IN ('submission', 'resolution', 'completion')
       ORDER BY earned_at ASC, id ASC`,
      [complaintId, complaint.citizen_id]
    ));
  }
  const [progressResult, statusResult, imageResult, rewardsResult] = await Promise.all(queries);
  return {
    ...complaint,
    progress_updates: progressResult.rows,
    ...(includeAdminDetails ? { status_updates: statusResult.rows } : {}),
    ...(includeAdminDetails ? { images: imageResult.rows } : {}),
    ...(includeAdminDetails ? { reward_transactions: rewardsResult.rows } : {}),
  };
};

const getCitizenFacts = async (citizenId) => {
  const [complaints, summary] = await Promise.all([
    query(
      `SELECT c.id, c.complaint_number, c.category, c.status, c.created_at,
              c.address, c.latitude, c.longitude,
              COALESCE(NULLIF(c.english_text, ''), NULLIF(c.original_text, ''),
                       NULLIF(c.generated_description, ''), NULLIF(c.generated_title, ''),
                       'Description not recorded') AS description,
              (SELECT p.progress_percentage
               FROM complaint_progress_updates p
               WHERE p.complaint_id = c.id
               ORDER BY p.created_at DESC, p.id DESC
               LIMIT 1) AS progress_percentage,
              (SELECT p.stage
               FROM complaint_progress_updates p
               WHERE p.complaint_id = c.id
               ORDER BY p.created_at DESC, p.id DESC
               LIMIT 1) AS latest_stage,
              (SELECT p.remarks
               FROM complaint_progress_updates p
               WHERE p.complaint_id = c.id
               ORDER BY p.created_at DESC, p.id DESC
               LIMIT 1) AS latest_progress_update
       FROM complaints c
       WHERE c.citizen_id = ?
       ORDER BY c.created_at DESC, c.id DESC`,
      [citizenId]
    ),
    query(
      `SELECT COUNT(*) AS total,
              SUM(status IN ('pending','Submitted','submitted')) AS pending,
              SUM(status IN ('assigned','in_progress')) AS in_progress,
              SUM(status = 'resolved') AS resolved
       FROM complaints
       WHERE citizen_id = ?`,
      [citizenId]
    ),
  ]);
  return {
    summary: {
      total: Number(summary.rows[0].total || 0),
      pending: Number(summary.rows[0].pending || 0),
      in_progress: Number(summary.rows[0].in_progress || 0),
      resolved: Number(summary.rows[0].resolved || 0),
    },
    complaints: complaints.rows,
  };
};

const getAdminFacts = async (message) => {
  return getAdminChatFacts(message);
};

const buildPrompt = ({
  role,
  message,
  language,
  complaint,
  facts,
  history,
  structuredResponse,
  structuredFacts,
}) => {
  const question = message.toLowerCase();
  const asksForProgress = /\b(progress|updates?|actions?)\b/.test(question);
  const asksForLocation = /\b(location|where|coordinates?|latitude|longitude)\b/.test(question);
  const asksForMultiple = /\b(all|each|every|list|show|which|categories|citizens|pending)\b/.test(question);
  const asksForFollowUp = /\b(it|that|those|them|there)\b/.test(question)
    || /^(and|what about|how about)\b/.test(question);
  const historyText = !structuredResponse && asksForFollowUp && history.length
    ? `Previous exchange: ${history[history.length - 1].message.slice(0, 160)}`
      + ` / ${history[history.length - 1].response.slice(0, 240)}`
    : '';
  const roleRules = role === 'admin'
    ? 'You are an admin assistant. Use only supplied database facts. Mention CNN data only if asked.'
      + (complaint ? ' An assigned_admin_name is not an assigned officer.' : '')
    : 'You are a citizen assistant. Use only this citizen’s records; never mention another citizen or CNN data.';
  const completenessRule = structuredResponse
    ? 'Reply with exactly: "Here are the database-backed details."'
    : asksForMultiple
      ? 'Include every matching record and each category present; never infer that an omitted category has zero records. Use concise Markdown bullets.'
      : 'Answer directly and concisely.';
  const progressRule = !structuredResponse && asksForProgress
    ? 'State total complaints, group every complaint by category, and include description, status, recorded progress and latest update. If no update exists, say "No progress update recorded."'
    : '';
  const locationRule = !structuredResponse && asksForLocation
    ? 'Use only the recorded address or coordinates. Say location is not recorded if absent.'
    : '';
  const promptFacts = structuredResponse
    ? {
      summary: facts?.summary || {
        total: 1,
        status: complaint?.status || 'Not recorded',
        category: complaint?.category || 'Not recorded',
      },
      verified_database_facts: structuredFacts,
    }
    : role === 'citizen'
      ? getCitizenPromptFacts(facts, message)
      : getAdminPromptFacts(facts, message);
  const promptComplaint = structuredResponse && complaint
    ? {
      complaint_number: complaint.complaint_number,
      category: complaint.category,
      status: complaint.status,
    }
    : complaint;

  return `Gramamitra. Answer in ${language || 'en'}. ${roleRules} ${completenessRule} ${progressRule} ${locationRule} Use normal Markdown without escaping symbols.
Only facts: ${JSON.stringify({ complaint: promptComplaint, facts: promptFacts })}
${historyText}
Question: ${message}`;
};

const getHistory = async (userId, sessionId) => {
  const result = await query(
    `SELECT message, response, user_role, created_at
     FROM chat_history
     WHERE user_id = ? AND session_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 8`,
    [userId, sessionId]
  );
  return result.rows.reverse();
};

export const chatWithComplaintContext = async ({ user, message, language, complaintId, sessionId }) => {
  if (!message || typeof message !== 'string' || !message.trim()) {
    const error = new Error('Enter a chat message.');
    error.statusCode = 400;
    throw error;
  }

  const safeSessionId = typeof sessionId === 'string' && sessionId.trim()
    ? sessionId.trim().slice(0, 100)
    : randomUUID();
  const history = user.role === 'admin' || complaintId
    ? []
    : await getHistory(user.id, safeSessionId);

  let complaint = null;
  let facts = null;
  if (user.role === 'citizen') {
    if (complaintId) {
      complaint = await getComplaintWithProgress(complaintId, { citizenId: user.id });
      if (!complaint) {
        const error = new Error('Complaint not found or not authorized.');
        error.statusCode = 404;
        throw error;
      }
    } else {
      facts = await getCitizenFacts(user.id);
    }
  } else if (user.role === 'admin') {
    if (complaintId) {
      complaint = await getComplaintWithProgress(complaintId, { includeAdminDetails: true });
      if (!complaint) {
        const error = new Error('Complaint not found.');
        error.statusCode = 404;
        throw error;
      }
    } else {
      facts = await getAdminFacts(message);
    }
  } else {
    const error = new Error('Insufficient permissions.');
    error.statusCode = 403;
    throw error;
  }

  const trimmedMessage = message.trim();
  const structuredSupplement = buildStructuredSupplement({
    role: user.role,
    message: trimmedMessage,
    complaint,
    facts,
  });
  const prompt = buildPrompt({
    role: user.role,
    message: trimmedMessage,
    language,
    complaint,
    facts,
    history,
    structuredResponse: Boolean(structuredSupplement),
    structuredFacts: structuredSupplement,
  });
  const maxTokens = getGenerationLimit({
    role: user.role,
    message: trimmedMessage,
    complaint,
    facts,
    hasStructuredSupplement: Boolean(structuredSupplement),
  });

  const aiUrl = `${process.env.LLM_SERVICE_URL || 'http://localhost:8001'}/api/chat`;
  let response = null;
  let aiFailure = null;
  try {
    response = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        language: language || 'en',
        context: complaint ? 'complaint-specific' : 'dashboard',
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    if (!structuredSupplement) {
      const serviceError = new Error(`Local AI service is unavailable: ${error.message}`);
      serviceError.statusCode = 503;
      throw serviceError;
    }
    aiFailure = `Local AI service is unavailable: ${error.message}`;
  }

  let generatedResponse = '';
  if (response) {
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error) {
      const failure = result?.error || 'Local AI response failed.';
      if (!structuredSupplement) {
        const serviceError = new Error(failure);
        serviceError.statusCode = response.status || 502;
        throw serviceError;
      }
      aiFailure = failure;
    } else {
      generatedResponse = result.response || result.generated_text || '';
      if (typeof generatedResponse !== 'string' || !generatedResponse.trim()) {
        if (!structuredSupplement) {
          const serviceError = new Error('Local AI returned an empty response.');
          serviceError.statusCode = 502;
          throw serviceError;
        }
        aiFailure = 'Local AI returned an empty response.';
      }
    }
  }

  let assistantResponse = generatedResponse.trim();
  if (structuredSupplement) {
    if (aiFailure) {
      console.error(`Structured ${user.role} chat used database facts after LLM failure: ${aiFailure}`);
      assistantResponse = `The AI summary was unavailable (${aiFailure}). Here is the complete database-backed result:\n\n${structuredSupplement}`;
    } else {
      const neutralLead = /^Here are the database-backed details\.?$/i.test(assistantResponse)
        ? assistantResponse
        : '';
      if (!neutralLead && assistantResponse) {
        console.warn(`Discarded unsupported factual lead in structured ${user.role} chat response.`);
      }
      assistantResponse = `${neutralLead ? `${neutralLead}\n\n` : ''}${structuredSupplement}`;
    }
  }

  await query(
    `INSERT INTO chat_history (user_id, user_role, session_id, message, response)
     VALUES (?, ?, ?, ?, ?)`,
    [user.id, user.role, safeSessionId, message.trim(), assistantResponse.trim()]
  );

  return {
    response: assistantResponse.trim(),
    session_id: safeSessionId,
    complaint_id: complaint?.id || null,
  };
};
