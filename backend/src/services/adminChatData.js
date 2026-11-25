import { query } from '../config/db.js';

const REPORT_LIMIT = 100;
const MONEY = (value) => Number(Number(value || 0).toFixed(2));

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const isRewardQuestion = (text) => /\b(reward|rewards|points?|earned|eligible|eligibility|paid|unpaid|balance|withdrawal|six months|six-month|waiting)\b/i.test(text);

const extractComplaintReference = (message) => {
  const match = message.match(/\b(?:complaint|report)\s*(?:number|no\.?|id|#)\s*#?([a-z0-9-]{1,40})\b/i)
    || message.match(/\b(?:complaint|report)\s+#([a-z0-9-]{1,40})\b/i);
  return match?.[1] || null;
};

const extractCitizenId = (message) => {
  const match = message.match(/\b(?:citizen|user)\s*(?:user\s*)?(?:id\s*)?#?\s*(\d+)\b/i);
  return match?.[1] || null;
};

const extractDateFilter = (message, dateColumn = 'c.created_at') => {
  const text = message.toLowerCase();
  const dateRange = message.match(/\b(?:between|from)\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (dateRange) return {
    sql: `${dateColumn} >= ? AND ${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`,
    params: [dateRange[1], dateRange[2]],
  };
  const exactDate = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (exactDate) return {
    sql: `${dateColumn} >= ? AND ${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`,
    params: [exactDate[1], exactDate[1]],
  };
  if (/\btoday\b/.test(text)) return { sql: `${dateColumn} >= CURDATE() AND ${dateColumn} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`, params: [] };
  if (/\byesterday\b/.test(text)) return { sql: `${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND ${dateColumn} < CURDATE()`, params: [] };
  if (/\bthis month\b/.test(text)) return { sql: `${dateColumn} >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AND ${dateColumn} < DATE_ADD(LAST_DAY(CURRENT_DATE), INTERVAL 1 DAY)`, params: [] };
  if (/\blast 7 days\b/.test(text)) return { sql: `${dateColumn} >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY)`, params: [] };
  if (/\blast 30 days\b/.test(text)) return { sql: `${dateColumn} >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)`, params: [] };
  return null;
};

const extractStatus = (message) => {
  const text = message.toLowerCase();
  if (/\b(unresolved|not resolved)\b/.test(text)
    || (/\bopen\b/.test(text) && !/\b(open\s+manhole|manhole)\b/.test(text))) {
    return { label: 'unresolved', sql: "LOWER(c.status) <> 'resolved'" };
  }
  if (/\bpending\b/.test(text)) return { label: 'pending', sql: "LOWER(c.status) IN ('pending', 'submitted')" };
  if (/\bstatus\s+(?:is\s+)?submitted\b/.test(text)) return { label: 'submitted', sql: "LOWER(c.status) = 'submitted'" };
  if (/\bresolved\b/.test(text)) return { label: 'resolved', sql: "LOWER(c.status) = 'resolved'" };
  if (/\bassigned\b/.test(text)) return { label: 'assigned', sql: "LOWER(c.status) = 'assigned'" };
  if (/\bin progress\b/.test(text)) {
    return { label: 'in progress', sql: "LOWER(c.status) IN ('assigned', 'in_progress')" };
  }
  if (/\brejected\b/.test(text)) return { label: 'rejected', sql: "LOWER(c.status) = 'rejected'" };
  return null;
};

const findCategory = (message, categories) => {
  const text = normalize(message);
  const knownIssuePhrases = [
    ['open', 'manhole'],
    ['open', 'manholes'],
    ['manhole'],
    ['manholes'],
    ['garbage'],
    ['waste'],
    ['trash'],
    ['pothole'],
    ['streetlight'],
    ['street', 'light'],
    ['water', 'leak'],
    ['sewage'],
  ];
  const tokens = text.split(' ').map((token) => (token === 'manholes' ? 'manhole' : token));
  const issueTerms = knownIssuePhrases.find((phrase) => (
    phrase.every((term) => tokens.includes(term))
  ));
  const category = categories
    .map((row) => row.category)
    .filter(Boolean)
    .sort((left, right) => normalize(right).length - normalize(left).length)
    .find((value) => {
      const normalized = normalize(value);
      return normalized.length > 1 && (` ${text} `).includes(` ${normalized} `);
    });
  if (category) {
    const categoryTokens = new Set(normalize(category).split(' '));
    const extraIssueTerms = issueTerms?.some((term) => !categoryTokens.has(term)) ? issueTerms : [];
    return { category, terms: extraIssueTerms };
  }
  const synonymGroups = [
    ['garbage', 'waste', 'trash', 'rubbish'],
    ['street light', 'streetlight'],
  ];
  for (const group of synonymGroups) {
    if (!group.some((term) => (` ${text} `).includes(` ${term} `))) continue;
    const candidates = categories
      .map((row) => row.category)
      .filter((value) => group.some((term) => (` ${normalize(value)} `).includes(` ${term} `)));
    if (candidates.length === 1) return { category: candidates[0], terms: [] };
  }
  if (issueTerms) return { category: null, terms: issueTerms.map((term) => (term === 'manholes' ? 'manhole' : term)) };

  const targetMatch = message.match(/\b(?:complaints?|reports?)\s+(?:about|for|in)\s+([^?.!,]+)/i)
    || message.match(/\b(?:how many|count|list|show|find|which|what)\s+(?:all\s+|the\s+)?(.+?)\s+(?:complaints?|reports?)\b/i);
  if (targetMatch) {
    const ignored = new Set([
      'all', 'and', 'are', 'by', 'category', 'citizen', 'complaint', 'complaints',
      'count', 'counts', 'each', 'for', 'from', 'have', 'in', 'is', 'many', 'of',
      'on', 'open', 'pending', 'reported', 'reports', 'rejected', 'resolved',
      'recent', 'status', 'submitted', 'the', 'this', 'today', 'to', 'unresolved',
      'were', 'what', 'which', 'who', 'wise', 'yesterday', 'assigned',
    ]);
    const terms = normalize(targetMatch[1])
      .split(' ')
      .filter((term) => term && !ignored.has(term));
    if (terms.length) return { category: null, terms };
  }
  return null;
};

const extractCitizenName = (message) => {
  if (/\b(all|each|every|citizen-wise|across all citizens)\b/i.test(message)) return null;
  const match = message.match(/\b(?:citizen|user)\s+(?:named|called)\s+([^?.!,]+)/i)
    || message.match(/\bsubmitted\s+by\s+([a-z][a-z .'-]{1,59}?)(?:\s+complaints?|\s+today|\s+this month|[?.!,]|$)/i)
    || message.match(/\bcomplaints?\s+(?:by|from)\s+([a-z][a-z .'-]{1,59}?)(?:[?.!,]|$)/i)
    || message.match(/\b(?:reward|points?|balance|details?)\s+(?:of|for)\s+(?:citizen\s+)?([a-z][a-z .'-]{1,59}?)(?:[?.!,]|$)/i)
    || message.match(/\b(?:for|of|by)\s+(?:citizen\s+)?([a-z][a-z .'-]{1,59}?)(?:'s)?\s+(?:reward|point|balance|complaint|submission|details?)\b/i);
  const name = match?.[1]?.replace(/\bcitizen\b/ig, '').trim();
  return name && name.length >= 2 ? name : null;
};

const rewardEventsCte = `
  WITH reward_events AS (
    SELECT COALESCE(citizen_id, user_id) AS citizen_id,
           COALESCE(complaint_id, -id) AS event_reference,
           CASE WHEN transaction_type = 'submission' THEN 'submission' ELSE 'resolution' END AS event_type,
           MAX(points) AS points,
           MAX(COALESCE(amount, points * 10)) AS amount,
           MAX(eligibility_date) AS eligibility_date
    FROM reward_transactions
    WHERE transaction_type IN ('submission', 'resolution', 'completion')
      AND COALESCE(citizen_id, user_id) IS NOT NULL
    GROUP BY COALESCE(citizen_id, user_id), COALESCE(complaint_id, -id),
             CASE WHEN transaction_type = 'submission' THEN 'submission' ELSE 'resolution' END
  ),
  reward_totals AS (
    SELECT citizen_id,
           SUM(points) AS total_points,
           SUM(amount) AS total_earned,
           SUM(CASE WHEN event_type = 'submission' THEN points ELSE 0 END) AS submission_points,
           SUM(CASE WHEN event_type = 'submission' THEN amount ELSE 0 END) AS submission_amount,
           SUM(CASE WHEN event_type = 'resolution' THEN points ELSE 0 END) AS resolution_points,
           SUM(CASE WHEN event_type = 'resolution' THEN amount ELSE 0 END) AS resolution_amount,
           SUM(CASE WHEN eligibility_date <= CURRENT_TIMESTAMP THEN amount ELSE 0 END) AS eligible_amount,
           SUM(CASE WHEN eligibility_date > CURRENT_TIMESTAMP THEN amount ELSE 0 END) AS waiting_amount,
           SUM(CASE WHEN eligibility_date IS NULL THEN amount ELSE 0 END) AS eligibility_unknown_amount
    FROM reward_events
    GROUP BY citizen_id
  )`;

const getRewardReport = async (runQuery, citizenName, citizenId, rankByEarnings = false) => {
  let citizen = null;
  if (citizenName || citizenId) {
    const matches = await runQuery(
      `SELECT id, full_name
       FROM users
       WHERE role = 'citizen' AND ${citizenId ? 'id = ?' : 'LOWER(full_name) LIKE LOWER(?)'}
       ORDER BY full_name ASC
       LIMIT 6`,
      [citizenId || `%${citizenName}%`]
    );
    if (matches.rows.length !== 1) {
      return {
        clarification: matches.rows.length
          ? `I found multiple citizens matching "${citizenName}". Please provide the citizen's exact name or user ID.`
          : `I could not identify the requested citizen. Please provide the exact name or user ID.`,
      };
    }
    [citizen] = matches.rows;
  }

  const citizenClause = citizen ? 'AND u.id = ?' : '';
  const params = citizen ? [citizen.id] : [];
  const [rowsResult, countResult, totalsResult] = await Promise.all([
    runQuery(
      `${rewardEventsCte}
       SELECT u.id AS citizen_id, u.full_name AS citizen_name,
              COALESCE(rt.total_points, 0) AS total_points,
              COALESCE(rt.total_earned, 0) AS total_earned,
              COALESCE(rt.submission_points, 0) AS submission_points,
              COALESCE(rt.submission_amount, 0) AS submission_amount,
              COALESCE(rt.resolution_points, 0) AS resolution_points,
              COALESCE(rt.resolution_amount, 0) AS resolution_amount,
              COALESCE(rt.eligible_amount, 0) AS eligible_amount,
              COALESCE(rt.waiting_amount, 0) AS waiting_amount,
              COALESCE(rt.eligibility_unknown_amount, 0) AS eligibility_unknown_amount,
              COALESCE(paid.amount, cr.total_paid_amount, 0) AS paid_amount,
              GREATEST(COALESCE(rt.total_earned, 0) - COALESCE(paid.amount, cr.total_paid_amount, 0), 0) AS unpaid_balance,
              (SELECT COUNT(*) FROM complaints c WHERE c.citizen_id = u.id) AS submitted_complaints,
              (SELECT COUNT(*) FROM complaints c WHERE c.citizen_id = u.id AND LOWER(c.status) = 'resolved') AS resolved_complaints
       FROM users u
       LEFT JOIN reward_totals rt ON rt.citizen_id = u.id
       LEFT JOIN citizen_rewards cr ON cr.citizen_id = u.id
       LEFT JOIN (
         SELECT citizen_id, SUM(amount) AS amount
         FROM reward_payment_history
         WHERE payment_status = 'PAID'
         GROUP BY citizen_id
       ) paid ON paid.citizen_id = u.id
       WHERE u.role = 'citizen' ${citizenClause}
       ORDER BY ${rankByEarnings ? 'COALESCE(rt.total_earned, 0) DESC, u.full_name ASC' : 'u.full_name ASC'}
       LIMIT ${REPORT_LIMIT + 1}`,
      params
    ),
    runQuery(
      `SELECT COUNT(*) AS count
       FROM users u
       WHERE u.role = 'citizen' ${citizenClause}`,
      params
    ),
    runQuery(
      `${rewardEventsCte}
       SELECT COALESCE(SUM(rt.total_points), 0) AS total_points,
              COALESCE(SUM(rt.total_earned), 0) AS total_earned,
              COALESCE(SUM(rt.submission_points), 0) AS submission_points,
              COALESCE(SUM(rt.resolution_points), 0) AS resolution_points,
              COALESCE(SUM(rt.eligible_amount), 0) AS eligible_amount,
              COALESCE(SUM(rt.waiting_amount), 0) AS waiting_amount,
              COALESCE(SUM(rt.eligibility_unknown_amount), 0) AS eligibility_unknown_amount,
              (SELECT COALESCE(SUM(amount), 0) FROM reward_payment_history
               WHERE payment_status = 'PAID' ${citizen ? 'AND citizen_id = ?' : ''}) AS total_paid
       FROM reward_totals rt
       ${citizen ? 'WHERE rt.citizen_id = ?' : ''}`,
      citizen ? [citizen.id, citizen.id] : []
    ),
  ]);
  const rows = rowsResult.rows.slice(0, REPORT_LIMIT).map((row) => ({
    ...row,
    total_points: Number(row.total_points || 0),
    total_earned: MONEY(row.total_earned),
    submission_points: Number(row.submission_points || 0),
    submission_amount: MONEY(row.submission_amount),
    resolution_points: Number(row.resolution_points || 0),
    resolution_amount: MONEY(row.resolution_amount),
    eligible_amount: MONEY(row.eligible_amount),
    waiting_amount: MONEY(row.waiting_amount),
    eligibility_unknown_amount: MONEY(row.eligibility_unknown_amount),
    paid_amount: MONEY(row.paid_amount),
    unpaid_balance: MONEY(row.unpaid_balance),
  }));
  const totals = totalsResult.rows[0] || {};
  return {
    citizen: citizen || null,
    rows,
    total_citizens: Number(countResult.rows[0]?.count || 0),
    truncated: Number(countResult.rows[0]?.count || 0) > REPORT_LIMIT,
    totals: {
      points: Number(totals.total_points || 0),
      earned: MONEY(totals.total_earned),
      submission_points: Number(totals.submission_points || 0),
      resolution_points: Number(totals.resolution_points || 0),
      eligible: MONEY(totals.eligible_amount),
      waiting: MONEY(totals.waiting_amount),
      eligibility_unknown: MONEY(totals.eligibility_unknown_amount),
      paid: MONEY(totals.total_paid),
    },
  };
};

const formatRewardRow = (row) => (
  `- ${row.citizen_name} (user ID ${row.citizen_id}): ${row.total_points} points / ₹${row.total_earned} earned; `
  + `submission ${row.submission_points} points (₹${row.submission_amount}); `
  + `resolution bonus ${row.resolution_points} points (₹${row.resolution_amount}); `
  + `eligible ₹${row.eligible_amount}; waiting six months ₹${row.waiting_amount}; `
  + `eligibility date unavailable for ₹${row.eligibility_unknown_amount}; `
  + `paid ₹${row.paid_amount}; unpaid balance ₹${row.unpaid_balance}; `
  + `${row.submitted_complaints} submitted, ${row.resolved_complaints} resolved.`
);

const formatComplaints = (rows, total) => {
  if (!rows.length) return 'No matching complaint records were found.';
  const lines = rows.map((row) => (
    `- ${row.complaint_number} (ID ${row.id}): ${row.citizen_name} (user ID ${row.citizen_id}); `
    + `${row.category || 'category not recorded'}; ${row.status}; submitted ${row.created_at}; `
    + `${row.description || 'description not recorded'}`
  ));
  if (total > REPORT_LIMIT) lines.push(`Showing ${REPORT_LIMIT} of ${total} matching complaints; this result is not exhaustive.`);
  return lines.join('\n');
};

export const getAdminChatFacts = async (message, runQuery = query) => {
  const reference = extractComplaintReference(message);
  const rewardQuestion = isRewardQuestion(message);
  const citizenName = extractCitizenName(message);
  const citizenId = extractCitizenId(message);
  const asksHighestReward = /\b(highest|most|top)\b/i.test(message)
    && /\b(reward|earned|amount|points?)\b/i.test(message);
  const asksCategoryBreakdown = /\b(category-wise|categories|by category|category counts)\b/i.test(message);
  const asksCitizenBreakdown = /\b(citizen-wise|each citizen|citizens?.*complaint count|complaint count.*citizen|most complaints|highest.*complaints)\b/i.test(message);
  const asksComplaints = /\b(complaints?|reports?)\b/i.test(message);
  const asksList = /\b(list|show|which|who|each|all)\b/i.test(message);
  const asksCount = /\b(how many|count|number|total)\b/i.test(message);
  const asksCitizenList = /\b(which|list|show|name)\s+citizens?\b|\bcitizens?\s+(?:who|whose)\b/i.test(message);
  const statusFilter = extractStatus(message);
  const dateFilter = extractDateFilter(message, statusFilter?.label === 'resolved' ? 'c.resolved_at' : 'c.created_at');

  if (reference) {
    const result = await runQuery(
      `SELECT c.id, c.complaint_number, c.category, c.status, c.created_at,
              c.citizen_id, u.full_name AS citizen_name,
              COALESCE(NULLIF(c.english_text, ''), NULLIF(c.original_text, ''),
                       NULLIF(c.generated_description, ''), NULLIF(c.generated_title, ''),
                       'Description not recorded') AS description
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id AND u.role = 'citizen'
       WHERE c.complaint_number = ? OR CAST(c.id AS CHAR) = ?
       LIMIT 2`,
      [reference, reference]
    );
    if (result.rows.length !== 1) {
      return {
        structuredResponse: result.rows.length
          ? `The reference "${reference}" matches more than one complaint. Please provide the exact complaint number.`
          : `No complaint was found for reference "${reference}".`,
        summary: { total: 0 },
      };
    }
    const complaint = result.rows[0];
    if (rewardQuestion) {
      const rewardRows = await runQuery(
        `SELECT transaction_type, points, amount, earned_at, eligibility_date,
                CASE WHEN eligibility_date <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS is_eligible
         FROM reward_transactions
         WHERE complaint_id = ?
           AND COALESCE(citizen_id, user_id) = ?
           AND transaction_type IN ('submission', 'resolution', 'completion')
         ORDER BY earned_at ASC, id ASC`,
        [complaint.id, complaint.citizen_id]
      );
      return {
        summary: { total: 1 },
        structuredResponse: [
          `Complaint ${complaint.complaint_number} (ID ${complaint.id}) was submitted by ${complaint.citizen_name} (user ID ${complaint.citizen_id}) on ${complaint.created_at}.`,
          `Category: ${complaint.category || 'Not recorded'}; status: ${complaint.status || 'Not recorded'}.`,
          `Description: ${complaint.description}.`,
          formatComplaintRewardFacts(complaint, rewardRows.rows),
        ].join('\n'),
        complaints: [complaint],
      };
    }
    return {
      summary: { total: 1 },
      structuredResponse: [
        `Complaint ${complaint.complaint_number} (ID ${complaint.id}) was submitted by ${complaint.citizen_name} (user ID ${complaint.citizen_id}) on ${complaint.created_at}.`,
        `Category: ${complaint.category || 'Not recorded'}; status: ${complaint.status || 'Not recorded'}.`,
        `Description: ${complaint.description}.`,
      ].join('\n'),
      complaints: [complaint],
    };
  }

  let citizen = null;
  if ((citizenName || citizenId) && asksComplaints) {
    const matches = await runQuery(
      `SELECT id, full_name
       FROM users
       WHERE role = 'citizen' AND ${citizenId ? 'id = ?' : 'LOWER(full_name) LIKE LOWER(?)'}
       ORDER BY full_name ASC
       LIMIT 6`,
      [citizenId || `%${citizenName}%`]
    );
    if (matches.rows.length !== 1) {
      return {
        summary: { total: 0 },
        structuredResponse: matches.rows.length
          ? `I found multiple citizens matching "${citizenName}". Please provide the citizen's exact name or user ID.`
          : `I could not identify a citizen matching "${citizenName}". Please provide the exact name or user ID.`,
      };
    }
    [citizen] = matches.rows;
  }

  if (rewardQuestion) {
    if (!citizenName && !citizenId
      && /\b(?:this|that|the|one|particular|specific)\s+citizen\b/i.test(message)
      && !/\b(all|each|every|citizen-wise|across all citizens)\b/i.test(message)) {
      return {
        summary: { total: 0 },
        structuredResponse: 'Please provide the citizen name or user ID; the main dashboard does not have a selected-citizen context.',
      };
    }
    const rewardReport = await getRewardReport(
      runQuery,
      citizenId ? null : citizenName,
      citizenId,
      asksHighestReward
    );
    if (rewardReport.clarification) {
      return { summary: { total: 0 }, structuredResponse: rewardReport.clarification };
    }
    const isSingle = Boolean(rewardReport.citizen);
    const displayedRows = rewardReport.rows;
    const total = rewardReport.totals;
    const lines = isSingle
      ? displayedRows.map(formatRewardRow)
      : [
        `Total across citizens: ${total.points} points / ₹${total.earned} earned; `
          + `submission rewards ${total.submission_points} points; resolution bonuses ${total.resolution_points} points; `
          + `eligible ₹${total.eligible}; waiting six months ₹${total.waiting}; `
          + `eligibility date unavailable for ₹${total.eligibility_unknown}; paid ₹${total.paid}.`,
        ...(asksHighestReward && displayedRows.length
          ? [`Highest reward earned: ${displayedRows[0].citizen_name} (user ID ${displayedRows[0].citizen_id}), ₹${displayedRows[0].total_earned}.`]
          : []),
        `Citizen reward details (${rewardReport.total_citizens} citizens${rewardReport.truncated ? `; first ${REPORT_LIMIT} shown` : ''}):`,
        ...displayedRows.map(formatRewardRow),
      ];
    if (rewardReport.truncated) {
      lines.push(`The citizen list is bounded to ${REPORT_LIMIT} records and is not exhaustive.`);
    }
    return {
      summary: { total: rewardReport.total_citizens },
      reward_report: rewardReport,
      structuredResponse: lines.join('\n'),
    };
  }

  if (/\b(cnn|prediction|confidence)\b/i.test(message)) {
    const [countResult, recordsResult] = await Promise.all([
      runQuery(
        `SELECT COUNT(*) AS count
         FROM complaint_images ci
         WHERE ci.cnn_confidence IS NOT NULL`
      ),
      runQuery(
        `SELECT c.complaint_number, ci.cnn_category, ci.cnn_confidence, ci.created_at
         FROM complaints c
         JOIN complaint_images ci ON ci.complaint_id = c.id
         WHERE ci.cnn_confidence IS NOT NULL
         ORDER BY ci.created_at DESC, ci.id DESC
         LIMIT ${REPORT_LIMIT + 1}`
      ),
    ]);
    const count = Number(countResult.rows[0]?.count || 0);
    const rows = recordsResult.rows.slice(0, REPORT_LIMIT);
    return {
      summary: { total: count },
      cnn: rows,
      structuredResponse: [
        `There are ${count} complaint image prediction record(s).`,
        ...rows.map((row) => `- ${row.complaint_number}: ${row.cnn_category || 'category not recorded'}, confidence ${row.cnn_confidence}, recorded ${row.created_at}`),
        recordsResult.rows.length > REPORT_LIMIT ? `Showing ${REPORT_LIMIT} of ${count} prediction records; this result is not exhaustive.` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  if (!asksComplaints && !asksCitizenBreakdown && !asksCitizenList && !asksCategoryBreakdown
    && !/\b(category|categories|garbage|waste|trash|manhole|pothole|streetlight|street light|sewage)\b/i.test(message)
    && !statusFilter && !dateFilter) {
    return {
      summary: { total: 0 },
      structuredResponse: 'Please ask a database question about a complaint, category, status, date, citizen, or reward metric.',
    };
  }

  let categories = [];
  let categoryFilter = null;
  if (asksCategoryBreakdown || asksComplaints
    || /\b(category|categories|garbage|waste|trash|manholes?|potholes?|streetlight|street light|sewage)\b/i.test(message)) {
    const categoryResult = await runQuery(
      'SELECT DISTINCT category FROM complaints WHERE category IS NOT NULL AND TRIM(category) <> \'\' ORDER BY category'
    );
    categories = categoryResult.rows;
    categoryFilter = findCategory(message, categories);
  }

  const where = [];
  const params = [];
  if (citizen) {
    where.push('c.citizen_id = ?');
    params.push(citizen.id);
  }
  if (categoryFilter?.category) {
    where.push('c.category = ?');
    params.push(categoryFilter.category);
  }
  if (categoryFilter?.terms?.length) {
    for (const term of categoryFilter.terms) {
      where.push(`LOWER(CONCAT_WS(' ', c.category, c.generated_title, c.generated_description, c.english_text, c.original_text)) LIKE ?`);
      params.push(`%${term}%`);
    }
  }
  if (statusFilter) where.push(statusFilter.sql);
  if (dateFilter) {
    where.push(dateFilter.sql);
    params.push(...dateFilter.params);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  if (/\bcategory|categories\b/i.test(message) && asksList && !categoryFilter && !asksCategoryBreakdown) {
    return {
      summary: { total: 0 },
      structuredResponse: categories.length
        ? `Available complaint categories in the database: ${categories.map((row) => row.category).join(', ')}. Please specify one category or ask for category-wise counts.`
        : 'No complaint categories are recorded in the database.',
    };
  }

  const [countResult, complaintsResult] = await Promise.all([
    runQuery(
      `SELECT COUNT(*) AS count, COUNT(DISTINCT c.citizen_id) AS distinct_citizens
       FROM complaints c ${whereSql}`,
      params
    ),
    runQuery(
      `SELECT c.id, c.complaint_number, c.category, c.status, c.created_at,
              c.citizen_id, u.full_name AS citizen_name,
              COALESCE(NULLIF(c.english_text, ''), NULLIF(c.original_text, ''),
                       NULLIF(c.generated_description, ''), NULLIF(c.generated_title, ''),
                       'Description not recorded') AS description
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id AND u.role = 'citizen'
       ${whereSql}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ${REPORT_LIMIT + 1}`,
      params
    ),
  ]);
  const total = Number(countResult.rows[0]?.count || 0);
  const complaintRows = complaintsResult.rows.slice(0, REPORT_LIMIT);

  if (asksCategoryBreakdown) {
    const categoryCounts = await runQuery(
      `SELECT COALESCE(NULLIF(TRIM(c.category), ''), 'Not recorded') AS category,
              COUNT(*) AS count
       FROM complaints c ${whereSql}
       GROUP BY COALESCE(NULLIF(TRIM(c.category), ''), 'Not recorded')
       ORDER BY count DESC, category ASC`,
      params
    );
    const lines = categoryCounts.rows.map((row) => `- ${row.category}: ${row.count}`);
    return {
      summary: { total },
      categories: categoryCounts.rows,
      structuredResponse: `Category-wise complaint counts (${total} total):\n${lines.length ? lines.join('\n') : 'No matching complaints.'}`,
    };
  }

  if (asksCitizenBreakdown) {
    const citizenResult = await runQuery(
      `SELECT u.id AS citizen_id, u.full_name AS citizen_name, COUNT(*) AS complaint_count
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id AND u.role = 'citizen'
       ${whereSql}
       GROUP BY u.id, u.full_name
       ORDER BY complaint_count DESC, u.full_name ASC
       LIMIT ${REPORT_LIMIT + 1}`,
      params
    );
    const rows = citizenResult.rows.slice(0, REPORT_LIMIT);
    const highest = Number(rows[0]?.complaint_count || 0);
    const lead = /\bmost|highest\b/i.test(message)
      ? `Most complaints: ${rows.filter((row) => Number(row.complaint_count) === highest).map((row) => row.citizen_name).join(', ')} (${highest}).`
      : '';
    return {
      summary: { total },
      complaints_by_citizen: rows,
      structuredResponse: [
        `Citizen-wise complaint counts (${Number(countResult.rows[0]?.distinct_citizens || 0)} citizens; ${total} matching complaints):`,
        ...rows.map((row) => `- ${row.citizen_name} (user ID ${row.citizen_id}): ${row.complaint_count}`),
        lead,
        citizenResult.rows.length > REPORT_LIMIT ? `Showing ${REPORT_LIMIT} citizens; this result is not exhaustive.` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  if (asksCitizenList) {
    const rowsResult = await runQuery(
      `SELECT DISTINCT u.id AS citizen_id, u.full_name AS citizen_name
       FROM complaints c
       JOIN users u ON u.id = c.citizen_id AND u.role = 'citizen'
       ${whereSql}
       ORDER BY u.full_name ASC
       LIMIT ${REPORT_LIMIT + 1}`,
      params
    );
    const rows = rowsResult.rows.slice(0, REPORT_LIMIT);
    return {
      summary: { total },
      citizens: rows,
      structuredResponse: [
        `${Number(countResult.rows[0]?.distinct_citizens || 0)} distinct citizen(s) reported matching complaints (${total} complaint records):`,
        ...rows.map((row) => `- ${row.citizen_name} (user ID ${row.citizen_id})`),
        rowsResult.rows.length > REPORT_LIMIT ? `Showing ${REPORT_LIMIT} citizens; this result is not exhaustive.` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  if (asksComplaints && (asksList || asksCount || categoryFilter || statusFilter || dateFilter)) {
    const statusDescriptor = statusFilter?.label ? ` ${statusFilter.label}` : '';
    const contextDescriptors = [
      categoryFilter?.category ? `in category "${categoryFilter.category}"` : '',
      dateFilter ? 'in the requested date range' : '',
    ].filter(Boolean);
    const context = contextDescriptors.length ? ` ${contextDescriptors.join(' ')}` : '';
    const structuredResponse = asksList
      ? `Found ${total}${statusDescriptor} complaint(s)${context}:\n${formatComplaints(complaintRows, total)}`
      : `There are ${total}${statusDescriptor} complaint(s)${context}.`;
    return {
      summary: { total },
      complaints: complaintRows,
      structuredResponse,
    };
  }

  if (/\b(overall|summari[sz]e|situation|how many complaints|total complaints)\b/i.test(message)) {
    const [summaryResult, statusResult, categoryResult] = await Promise.all([
      runQuery(
        `SELECT COUNT(*) AS total,
                SUM(LOWER(status) IN ('pending', 'submitted')) AS pending,
                SUM(LOWER(status) IN ('assigned', 'in_progress')) AS in_progress,
                SUM(LOWER(status) = 'resolved') AS resolved
         FROM complaints`
      ),
      runQuery('SELECT status, COUNT(*) AS count FROM complaints GROUP BY status ORDER BY count DESC'),
      runQuery(
        `SELECT COALESCE(NULLIF(TRIM(category), ''), 'Not recorded') AS category, COUNT(*) AS count
         FROM complaints GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'Not recorded')
         ORDER BY count DESC, category ASC`
      ),
    ]);
    const summary = summaryResult.rows[0] || {};
    return {
      summary,
      statuses: statusResult.rows,
      categories: categoryResult.rows,
      structuredResponse: `Complaints: ${summary.total || 0} total; ${summary.pending || 0} pending/submitted; ${summary.in_progress || 0} in progress; ${summary.resolved || 0} resolved.`,
    };
  }

  return {
    summary: { total },
    structuredResponse: 'Please specify a complaint number, category, status, date range, citizen, or reward metric so I can query the relevant records.',
  };
};

export const formatComplaintRewardFacts = (complaint, transactions) => {
  const events = new Map();
  for (const transaction of transactions) {
    const kind = transaction.transaction_type === 'submission' ? 'submission' : 'resolution';
    const existing = events.get(kind);
    if (!existing || Number(transaction.points || 0) > Number(existing.points || 0)) {
      events.set(kind, transaction);
    }
  }
  const rows = [...events.values()];
  if (!rows.length) return 'No reward transactions are recorded for this complaint; its reward amount and eligibility are unavailable.';

  const totals = rows.reduce((result, transaction) => {
    const amount = MONEY(transaction.amount ?? Number(transaction.points || 0) * 10);
    const points = Number(transaction.points || 0);
    result.points += points;
    result.amount += amount;
    if (!transaction.eligibility_date) result.unknown += amount;
    else if (transaction.is_eligible !== undefined
      ? Boolean(Number(transaction.is_eligible))
      : new Date(transaction.eligibility_date) <= new Date()) result.eligible += amount;
    else result.waiting += amount;
    if (transaction.transaction_type === 'submission') {
      result.submissionPoints += points;
      result.submissionAmount += amount;
    } else {
      result.resolutionPoints += points;
      result.resolutionAmount += amount;
    }
    return result;
  }, {
    points: 0,
    amount: 0,
    eligible: 0,
    waiting: 0,
    unknown: 0,
    submissionPoints: 0,
    submissionAmount: 0,
    resolutionPoints: 0,
    resolutionAmount: 0,
  });
  const unknownEligibility = totals.unknown
    ? ` ₹${MONEY(totals.unknown)} has no recorded eligibility date.`
    : '';
  const resolution = totals.resolutionPoints > 0
    ? `Resolution bonus: ${totals.resolutionPoints} point(s) (₹${MONEY(totals.resolutionAmount)}).`
    : 'No resolution bonus transaction is recorded.';
  return `Complaint ${complaint.complaint_number}: ${totals.points} reward point(s), ₹${MONEY(totals.amount)} total. `
    + `Submission reward: ${totals.submissionPoints} point(s) (₹${MONEY(totals.submissionAmount)}). `
    + `${resolution} Eligible now: ₹${MONEY(totals.eligible)}; waiting six months: ₹${MONEY(totals.waiting)}.${unknownEligibility} `
    + 'Complaint-level paid amount is unavailable because payment history is linked to citizen withdrawals, not individual complaints.';
};
