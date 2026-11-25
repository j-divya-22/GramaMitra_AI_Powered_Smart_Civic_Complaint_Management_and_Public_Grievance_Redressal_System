import test from 'node:test';
import assert from 'node:assert/strict';
import { formatComplaintRewardFacts, getAdminChatFacts } from '../src/services/adminChatData.js';
import { buildStructuredSupplement, getComplaintWithProgress } from '../src/services/llmChat.js';

const queryResult = (rows = []) => ({ rows });

test('open-manhole questions filter both matching terms and do not return all complaints', async () => {
  const calls = [];
  const facts = await getAdminChatFacts(
    'How many open manholes complaints have been submitted?',
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT category')) return queryResult([{ category: 'Garbage' }]);
      if (sql.includes('COUNT(*) AS count, COUNT(DISTINCT')) return queryResult([{ count: 1, distinct_citizens: 1 }]);
      if (sql.includes('SELECT c.id, c.complaint_number')) {
        return queryResult([{
          id: 8,
          complaint_number: 'GM-8',
          citizen_id: 3,
          citizen_name: 'Test Citizen',
          category: 'Drainage',
          status: 'pending',
          created_at: '2026-11-24 08:00:00',
          description: 'Open manhole reported near the road',
        }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );

  assert.match(facts.structuredResponse, /There are 1/);
  const detailQuery = calls.find(({ sql }) => sql.includes('SELECT c.id, c.complaint_number'));
  assert.ok(detailQuery.sql.includes('LOWER(CONCAT_WS'));
  assert.deepEqual(detailQuery.params, ['%open%', '%manhole%']);
});

test('category-specific citizen list returns only citizens with matching complaint records', async () => {
  const calls = [];
  const facts = await getAdminChatFacts(
    'List all citizens who reported open manholes',
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT category')) {
        return queryResult([{ category: 'Drainage' }, { category: 'Garbage' }]);
      }
      if (sql.includes('COUNT(*) AS count, COUNT(DISTINCT')) {
        return queryResult([{ count: 1, distinct_citizens: 1 }]);
      }
      if (sql.includes('SELECT c.id, c.complaint_number')) return queryResult([]);
      if (sql.includes('SELECT DISTINCT u.id AS citizen_id')) {
        return queryResult([{ citizen_id: 7, citizen_name: 'Matching Citizen' }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );
  const citizenQuery = calls.find(({ sql }) => sql.includes('SELECT DISTINCT u.id AS citizen_id'));
  assert.deepEqual(citizenQuery.params, ['%open%', '%manhole%']);
  assert.ok(citizenQuery.sql.includes('LOWER(CONCAT_WS'));
  assert.match(facts.structuredResponse, /Matching Citizen/);
  assert.doesNotMatch(facts.structuredResponse, /unrelated citizen/i);
});

test('category-specific list uses the actual category value as a parameter', async () => {
  const calls = [];
  const facts = await getAdminChatFacts(
    'Show complaints belonging to the garbage category',
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT category')) {
        return queryResult([{ category: 'Garbage' }, { category: 'Water' }]);
      }
      if (sql.includes('COUNT(*) AS count, COUNT(DISTINCT')) return queryResult([{ count: 1, distinct_citizens: 1 }]);
      if (sql.includes('SELECT c.id, c.complaint_number')) {
        return queryResult([{
          id: 1,
          complaint_number: 'GM-1',
          citizen_id: 3,
          citizen_name: 'Test Citizen',
          category: 'Garbage',
          status: 'resolved',
          created_at: '2026-11-20 09:00:00',
          description: 'Garbage collection was missed',
        }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );

  const detailQuery = calls.find(({ sql }) => sql.includes('SELECT c.id, c.complaint_number'));
  assert.deepEqual(detailQuery.params, ['Garbage']);
  assert.match(detailQuery.sql, /WHERE c\.category = \?/);
  assert.match(facts.structuredResponse, /GM-1/);
});

test('resolved-this-month count filters on resolved_at and status', async () => {
  const calls = [];
  const facts = await getAdminChatFacts(
    'How many complaints were resolved this month?',
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT category')) return queryResult([]);
      if (sql.includes('COUNT(*) AS count, COUNT(DISTINCT')) return queryResult([{ count: 3, distinct_citizens: 2 }]);
      if (sql.includes('SELECT c.id, c.complaint_number')) return queryResult([]);
      throw new Error(`Unexpected query: ${sql}`);
    }
  );
  const countQuery = calls.find(({ sql }) => sql.includes('COUNT(*) AS count, COUNT(DISTINCT'));
  assert.match(countQuery.sql, /LOWER\(c\.status\) = 'resolved'/);
  assert.match(countQuery.sql, /c\.resolved_at >= DATE_FORMAT/);
  assert.match(facts.structuredResponse, /There are 3 resolved complaint/);
});

test('category-wise counts do not accidentally apply a category filter', async () => {
  const calls = [];
  const facts = await getAdminChatFacts(
    'Show category-wise complaint counts',
    async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT DISTINCT category')) return queryResult([{ category: 'Garbage' }]);
      if (sql.includes('COUNT(*) AS count, COUNT(DISTINCT')) return queryResult([{ count: 4, distinct_citizens: 3 }]);
      if (sql.includes('SELECT c.id, c.complaint_number')) return queryResult([]);
      if (sql.includes('GROUP BY COALESCE(NULLIF(TRIM(c.category)')) {
        return queryResult([{ category: 'Garbage', count: 4 }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );
  const countQuery = calls.find(({ sql }) => sql.includes('COUNT(*) AS count, COUNT(DISTINCT'));
  assert.deepEqual(countQuery.params, []);
  assert.match(facts.structuredResponse, /Garbage: 4/);
});

test('citizen complaint rewards are complaint-scoped and eligibility uses each reward event', async () => {
  let rewardQuery;
  const facts = await getAdminChatFacts(
    'How many reward points did complaint number 25 generate?',
    async (sql, params = []) => {
      if (sql.includes('SELECT c.id, c.complaint_number')) {
        return queryResult([{
          id: 25,
          complaint_number: 'GM-25',
          citizen_id: 9,
          citizen_name: 'Test Citizen',
          category: 'Road',
          status: 'resolved',
          created_at: '2026-05-01 10:00:00',
          description: 'A road issue',
        }]);
      }
      if (sql.includes('FROM reward_transactions')) {
        rewardQuery = { sql, params };
        return queryResult([
          {
            transaction_type: 'submission',
            points: 1,
            amount: 10,
            eligibility_date: '2026-10-01 00:00:00',
            is_eligible: 1,
          },
          {
            transaction_type: 'resolution',
            points: 1,
            amount: 10,
            eligibility_date: '2027-01-01 00:00:00',
            is_eligible: 0,
          },
        ]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );

  assert.deepEqual(rewardQuery.params, [25, 9]);
  assert.match(rewardQuery.sql, /WHERE complaint_id = \?/);
  assert.match(facts.structuredResponse, /2 reward point/);
  assert.match(facts.structuredResponse, /Eligible now: ₹10/);
  assert.match(facts.structuredResponse, /waiting six months: ₹10/);
  assert.doesNotMatch(facts.structuredResponse, /other complaint|another citizen/i);
});

test('complaint reward formatter reports missing ledger data and unavailable payment attribution', () => {
  const missing = formatComplaintRewardFacts({ complaint_number: 'GM-1' }, []);
  assert.match(missing, /No reward transactions are recorded/);

  const response = formatComplaintRewardFacts(
    { complaint_number: 'GM-2' },
    [{
      transaction_type: 'submission',
      points: 1,
      amount: 10,
      eligibility_date: null,
    }]
  );
  assert.match(response, /eligibility date/);
  assert.match(response, /payment history is linked to citizen withdrawals/);
});

test('individual complaint loader scopes its citizen, history, and reward queries to the opened complaint', async () => {
  const calls = [];
  const complaint = await getComplaintWithProgress(41, {
    includeAdminDetails: true,
    runQuery: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM complaints c')) {
        return queryResult([{
          id: 41,
          complaint_number: 'GM-41',
          citizen_id: 7,
          citizen_name: 'Current Citizen',
          category: 'Road',
          status: 'resolved',
          created_at: '2026-05-01 10:00:00',
        }]);
      }
      if (sql.includes('FROM complaint_progress_updates')) return queryResult([]);
      if (sql.includes('FROM complaint_status_history')) return queryResult([]);
      if (sql.includes('FROM complaint_images')) return queryResult([]);
      if (sql.includes('FROM reward_transactions')) {
        return queryResult([{
          transaction_type: 'submission',
          points: 1,
          amount: 10,
          eligibility_date: '2026-10-01 00:00:00',
          is_eligible: 1,
        }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });

  assert.equal(complaint.citizen_name, 'Current Citizen');
  assert.equal(complaint.citizen_id, 7);
  assert.equal(complaint.reward_transactions.length, 1);
  assert.ok(calls.every(({ params }) => params[0] === 41));
  assert.match(calls.find(({ sql }) => sql.includes('FROM reward_transactions')).sql, /WHERE complaint_id = \?/);
});

test('individual complaint answers are composed only from its stored facts', () => {
  const response = buildStructuredSupplement({
    role: 'admin',
    message: 'Who submitted this complaint, when, and how much reward did it earn?',
    complaint: {
      id: 41,
      complaint_number: 'GM-41',
      citizen_id: 7,
      citizen_name: 'Current Citizen',
      created_at: '2026-05-01 10:00:00',
      category: 'Road',
      status: 'resolved',
      reward_transactions: [
        {
          transaction_type: 'submission',
          points: 1,
          amount: 10,
          eligibility_date: '2026-10-01 00:00:00',
          is_eligible: 1,
        },
        {
          transaction_type: 'resolution',
          points: 1,
          amount: 10,
          eligibility_date: '2027-01-01 00:00:00',
          is_eligible: 0,
        },
      ],
    },
  });

  assert.match(response, /Current Citizen/);
  assert.match(response, /user ID: 7/);
  assert.match(response, /2026-05-01 10:00:00/);
  assert.match(response, /2 reward point/);
  assert.match(response, /Eligible now: ₹10/);
  assert.match(response, /waiting six months: ₹10/);
});

test('citizen reward report resolves one citizen and de-duplicates legacy resolution ledger rows', async () => {
  const queries = [];
  const facts = await getAdminChatFacts(
    'What are the reward points for citizen named Sam Reed?',
    async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT id, full_name') && sql.includes('LOWER(full_name)')) {
        return queryResult([{ id: 5, full_name: 'Sam Reed' }]);
      }
      if (sql.includes('SELECT u.id AS citizen_id')) {
        return queryResult([{
          citizen_id: 5,
          citizen_name: 'Sam Reed',
          total_points: 2,
          total_earned: 20,
          submission_points: 1,
          submission_amount: 10,
          resolution_points: 1,
          resolution_amount: 10,
          eligible_amount: 10,
          waiting_amount: 10,
          eligibility_unknown_amount: 0,
          paid_amount: 0,
          unpaid_balance: 20,
          submitted_complaints: 1,
          resolved_complaints: 1,
        }]);
      }
      if (sql.includes('SELECT COUNT(*) AS count') && sql.includes('FROM users u')) {
        return queryResult([{ count: 1 }]);
      }
      if (sql.includes('SELECT COALESCE(SUM(rt.total_points)')) {
        return queryResult([{
          total_points: 2,
          total_earned: 20,
          submission_points: 1,
          resolution_points: 1,
          eligible_amount: 10,
          waiting_amount: 10,
          eligibility_unknown_amount: 0,
          total_paid: 0,
        }]);
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  );

  assert.match(facts.structuredResponse, /Sam Reed \(user ID 5\)/);
  assert.match(facts.structuredResponse, /2 points \/ ₹20 earned/);
  const ledgerQuery = queries.find(({ sql }) => sql.includes('WITH reward_events'));
  assert.match(ledgerQuery.sql, /CASE WHEN transaction_type = 'submission' THEN 'submission' ELSE 'resolution' END/);
  assert.match(ledgerQuery.sql, /transaction_type IN \('submission', 'resolution', 'completion'\)/);
});
