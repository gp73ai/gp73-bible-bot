// ============================================================
// GP73 Answer Engine v1 — built 2026-05-23
// Side-by-side with /api/ask. Does NOT replace anything.
// Four-layer voice control: system prompt + few-shots + validator + verbatim fallback.
//
//   Locked direction (Chief, 2026-05-23):
//     - few-shot examples are REAL transcript excerpts, never rewritten
//     - validator is strict (7 reject rules)
//     - verbatim fallback after 3 attempts (zero LLM modification)
//     - Obsidian-first (keyword on Title/Summary/core_principles), Supabase second (pgvector)
//     - "Pulled from: [sermon]" citation always
//
//   Endpoint:  POST /api/answer    body: { question, sessionId?, tier? }
//   Returns:   { source, answer, pulled_from, fallback, attempts, reject_reasons? }
// ============================================================

export const config = { runtime: 'nodejs' };

// ============================================================
// 1. VOICE — hardened system prompt (no soft phrasing tolerated)
// ============================================================
const VOICE_SYSTEM_PROMPT = `You are GP73 — the Bible Intelligence engine of Apostle Sedrick Davis, known as Godsprisoner.

ABSOLUTE VOICE RULES — violations cause your output to be REJECTED and you will be re-prompted:

1. NEVER end a response with a question. Every response ends with a flat declarative statement.
2. NEVER use any of these phrases: "reflect on", "consider how", "many believe", "some scholars", "it's important to", "start by", "this isn't about", "remember to", "try to", "perhaps", "you may want to", "you might", "feel free to", "keep in mind", "essentially", "in other words".
3. NEVER paraphrase scripture. If scripture is provided in context, quote it word-for-word in KJV.
4. NEVER add general explanation when the user only asked for the verse or the quote. Direct ask = direct quote + reference + at most one declarative.
5. NEVER soften correction to spare feelings. You are a teacher who does not play around.
6. NEVER speak in counselor tone. You answer first. You correct second. You declare third.

REQUIRED:
- Use the TEACHING CONTEXT below. Quote at least one continuous 8-word phrase from it word-for-word.
- KJV scripture only. Book Chapter:Verse cited.
- End with a bold declarative sentence — not a question.

FEW-SHOT VOICE REFERENCE — these are real excerpts from Chief's sermons. Match this voice:`;

// ============================================================
// 2. FEW-SHOTS — verbatim excerpts from real transcripts (no rewriting)
// ============================================================
const FEW_SHOTS = [
  {
    sermon: 'You ain\'t seen nothing yet',
    text: `One thing for sure, you will never come to revelation without a struggle. You will never go to the next level of what you need to unlock yourself without a struggle. There must be a battle before you get to your next level. A good thing about being sent by God is he signed the check before he send you. When you're sent on an assignment and you know it's an assignment, all of the contractual terms are already fulfilled before you get there.`,
  },
  {
    sermon: 'Turn the Tables',
    text: `We've been churched long enough. As a matter of fact, I think we've been churching so long that we don't know how to be real when the opportunity presents itself. And if you ever find yourself stuck in religion or stuck in church, you'll bleed to death while everybody else is growing and living. That's not a good place to be in. People that have come in after you live and you die. So I'm always, one thing you can count on with me, I'm gonna keep it 100.`,
  },
  {
    sermon: 'You ain\'t seen nothing yet',
    text: `I am crazy. I do say things that are untraditional and what you might call unorthodox if you are of the orthodox faith of Christianity. I come to offend those that are religious. I come to wake up those who are stuck, hurt in places that they shouldn't be because of religious stuff. I've come to open your eyes to the facts that if God were finished with us then we should all be in heaven right now. So because he's not done we got work to do.`,
  },
  {
    sermon: 'Who\'s Your Master',
    text: `The right sound causes God to come and sit in an atmosphere. So where there is no sound, there can be no valid praise for God. Where there is no sound, it says to God that your spirit does not agree with his presence. Be careful of allowing life to silence your sound because that's what life comes to do.`,
  },
  {
    sermon: 'You Play 2 Much',
    text: `You can get saved and not be a new creature. That's why a saved person can commit old habits, because they're not yet a new creature. The new creature does not come until you get in Christ. If any man or woman be in Christ he is a new creature. All things are passed away behold all things are made new. If you still feel like you're the same old person get in Christ. If you're still struggling with the same old habits get in Christ. If you're still battling with the same mentalities get where? The answer to all of your issues are where? In Christ.`,
  },
];

// ============================================================
// 3. BANNED LISTS
// ============================================================
const BANNED_PHRASES = [
  'reflect on', 'consider how', 'many believe', 'some scholars',
  "it's important to", 'start by', "this isn't about", 'remember to',
  'try to', 'perhaps', 'you may want to', 'you might',
  'feel free to', 'keep in mind', 'essentially', 'in other words',
];
const POLITENESS_MARKERS = ['please', 'kindly', 'let\'s', 'we can', 'allow me to', 'i\'d like to'];
const STOP_WORDS = new Set(['what','is','the','a','an','of','to','in','and','or','for','do','does','how','why','when','who','are','was','were','be','been','i','my','me','you','your','we','they','it','this','that','can','will','have','has','had','not','no','but','about','on','with']);

// ============================================================
// 4. LAYER A — keyword retrieval (Obsidian-equivalent: Title/Summary/core_principles)
// ============================================================
async function queryLayerA(question) {
  const terms = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3 && !STOP_WORDS.has(t))
    .slice(0, 6);
  if (!terms.length) return null;

  // Build a Supabase PostgREST or= filter against Title and Summary
  //   or=(Title.ilike.*term1*,Summary.ilike.*term1*,Title.ilike.*term2*,…)
  const conds = [];
  for (const t of terms) {
    const safe = encodeURIComponent(`*${t}*`);
    conds.push(`Title.ilike.${safe}`);
    conds.push(`Summary.ilike.${safe}`);
  }
  const url = `${process.env.SUPABASE_URL}/rest/v1/documents?select=id,Title,Content,Summary,core_principles,Category&or=(${conds.join(',')})&limit=12`;

  try {
    const r = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    });
    if (!r.ok) { console.warn('[GP73 ANSWER] LayerA HTTP', r.status); return null; }
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return null;

    // Score each row by how many terms it matches in Title (weighted 3x) + Summary (1x)
    const scored = rows.map(row => {
      const title = (row.Title || '').toLowerCase();
      const summary = (row.Summary || '').toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        if (summary.includes(t)) score += 1;
      }
      return { row, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0];
    if (!top || top.score < 2) return null; // require at least 2 weighted hits
    return {
      source: 'layerA-keyword',
      sermon: top.row.Title || 'Untitled',
      content: top.row.Content || top.row.Summary || '',
      summary: top.row.Summary || '',
      category: top.row.Category || '',
      score: top.score,
    };
  } catch (e) {
    console.warn('[GP73 ANSWER] LayerA error:', e.message);
    return null;
  }
}

// ============================================================
// 5. LAYER B — semantic retrieval (Supabase pgvector match_documents RPC)
// ============================================================
async function getEmbedding(question) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: question }),
  });
  const data = await r.json();
  return data.data?.[0]?.embedding;
}
async function queryLayerB(question) {
  try {
    const embedding = await getEmbedding(question);
    if (!embedding) return null;
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/match_documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ query_embedding: embedding, match_count: 5 }),
    });
    if (!r.ok) return null;
    const docs = await r.json();
    if (!Array.isArray(docs) || !docs.length) return null;
    const top = docs.filter(d => (d.similarity || 0) >= 0.35)[0];
    if (!top) return null;
    return {
      source: 'layerB-embedding',
      sermon: top.Title || top.title || 'Untitled',
      content: top.Content || top.content || '',
      summary: top.Summary || top.summary || '',
      category: top.Category || top.category || '',
      similarity: top.similarity,
    };
  } catch (e) {
    console.warn('[GP73 ANSWER] LayerB error:', e.message);
    return null;
  }
}

// ============================================================
// 6. RETRIEVAL ORCHESTRATION — Obsidian-first, Supabase second
// ============================================================
async function retrieveTeaching(question) {
  const a = await queryLayerA(question);
  if (a) return a;
  const b = await queryLayerB(question);
  return b;
}

// ============================================================
// 7. VALIDATOR — 7 reject rules (any failure → reject + regenerate)
// ============================================================
function shingles(text, n = 8) {
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(' '));
  return out;
}

function validate(response, teaching, askedDirectQuote) {
  const reasons = [];
  if (!response || !response.trim()) { reasons.push('rule 0: empty response'); return reasons; }
  const r = response.trim();
  const rLower = r.toLowerCase();

  // Rule 1: ends with `?`
  const lastSentence = r.split(/[.!?]\s*/).filter(Boolean).pop() || r;
  if (r.trim().endsWith('?')) reasons.push('rule 1: ends with question mark');

  // Rule 2: banned phrases
  for (const p of BANNED_PHRASES) {
    if (rLower.includes(p)) reasons.push(`rule 2: banned phrase "${p}"`);
  }

  // Rule 4: direct-quote asks must be quote+reference, max 1 declarative
  if (askedDirectQuote) {
    const sentences = r.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) reasons.push('rule 4: added explanation when direct quote was requested');
  }

  // Rule 5: must quote at least one 8-word shingle verbatim from retrieved teaching
  if (teaching && teaching.content) {
    const teachShingles = new Set(shingles(teaching.content, 8));
    const respShingles = shingles(r, 8);
    let matched = false;
    for (const s of respShingles) {
      if (teachShingles.has(s)) { matched = true; break; }
    }
    if (!matched && teachShingles.size > 0) {
      reasons.push('rule 5: no 8-word verbatim quote from retrieved teaching');
    }
  }

  // Rule 6a: avg sentence length must not be > 1.5x retrieved teaching's
  if (teaching && teaching.content) {
    const respSentences = r.split(/[.!?]/).filter(s => s.trim().length > 0);
    const teachSentences = teaching.content.split(/[.!?]/).filter(s => s.trim().length > 0);
    if (respSentences.length && teachSentences.length) {
      const respAvg = respSentences.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / respSentences.length;
      const teachAvg = teachSentences.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / teachSentences.length;
      if (respAvg > teachAvg * 1.5) {
        reasons.push(`rule 6a: response avg sentence length ${respAvg.toFixed(1)} > 1.5x teaching's ${teachAvg.toFixed(1)}`);
      }
    }
  }

  // Rule 6b: politeness marker count
  let respPolite = 0, teachPolite = 0;
  for (const m of POLITENESS_MARKERS) {
    respPolite += (rLower.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (teaching && teaching.content) {
      teachPolite += (teaching.content.toLowerCase().match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    }
  }
  if (respPolite > teachPolite + 2) reasons.push(`rule 6b: too polite (${respPolite} markers vs teaching ${teachPolite})`);

  // Rule 7: must contain at least one bold declarative starting with You/That/God/The (no modal verb in first 4 words)
  const sentences = r.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  let foundDeclarative = false;
  for (const s of sentences) {
    if (/^(You|That|God|The)\s+/.test(s)) {
      const first4 = s.split(/\s+/).slice(0, 4).join(' ').toLowerCase();
      if (!/\b(should|might|may|could|would)\b/.test(first4)) {
        foundDeclarative = true; break;
      }
    }
  }
  if (!foundDeclarative) reasons.push('rule 7: no bold declarative sentence');

  return reasons;
}

// ============================================================
// 8. PROMPT BUILDER — system + few-shots + teaching + question
// ============================================================
function buildMessages(question, teaching, extraDirective = '') {
  const fewShotBlock = FEW_SHOTS
    .map((fs, i) => `\n[Example ${i + 1} — from "${fs.sermon}"]\n${fs.text}`)
    .join('\n');

  const teachingBlock = teaching && teaching.content
    ? `\n\nTEACHING CONTEXT (you MUST quote at least one 8-word phrase from this word-for-word):\n[Sermon: ${teaching.sermon}]\n${teaching.content.slice(0, 4000)}`
    : '\n\nTEACHING CONTEXT: (no specific sermon matched — use your voice rules and KJV scripture only; be brief and direct)';

  const systemContent = VOICE_SYSTEM_PROMPT + fewShotBlock + teachingBlock + (extraDirective ? `\n\nADDITIONAL DIRECTIVE: ${extraDirective}` : '');

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: question },
  ];
}

// ============================================================
// 9. GPT CALL
// ============================================================
async function callGPT(messages, temperature = 0.3) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o', temperature, max_tokens: 400, messages }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || '';
}

// ============================================================
// 10. VERBATIM FALLBACK — zero LLM, paragraph from sermon as-is
// ============================================================
function pickBestParagraph(teaching, question) {
  if (!teaching || !teaching.content) return null;
  const paras = teaching.content.split(/\n\s*\n|(?:\.\s+){2,}/).map(p => p.trim()).filter(p => p.length > 80);
  if (!paras.length) return teaching.content.slice(0, 1200);
  const qTerms = question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 3 && !STOP_WORDS.has(t));
  let best = paras[0], bestScore = -1;
  for (const p of paras) {
    const pl = p.toLowerCase();
    let s = 0;
    for (const t of qTerms) if (pl.includes(t)) s++;
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return best;
}

// ============================================================
// 11. INTENT — direct-quote vs explain (lightweight)
// ============================================================
function isDirectQuoteAsk(question) {
  const q = question.toLowerCase();
  return /\b(quote|read|say|says|what does .* say|recite)\b/.test(q);
}

// ============================================================
// 12. MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  const { question = '', sessionId = 'default', tier = 'free' } = req.body || {};
  if (!question.trim()) return res.status(400).json({ error: 'question required' });

  const t0 = Date.now();
  const askedDirectQuote = isDirectQuoteAsk(question);

  // Step 1 — retrieve teaching (Obsidian-equivalent first, Supabase second)
  const teaching = await retrieveTeaching(question);

  // Step 2 — generate + validate, up to 3 attempts
  const attemptsLog = [];
  let finalAnswer = null, finalAttempt = 0;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let directive = '';
    let temp = 0.3;
    if (attempt === 2) {
      directive = 'Previous attempt violated voice rules. Do NOT use any banned phrase. Quote the teaching word-for-word.';
    } else if (attempt === 3) {
      directive = 'Previous two attempts violated voice rules. Be extremely brief. Quote the teaching directly. End with a flat declarative statement, never a question.';
      temp = 0.2;
    }
    const messages = buildMessages(question, teaching, directive);
    let response;
    try {
      response = await callGPT(messages, temp);
    } catch (e) {
      attemptsLog.push({ attempt, error: e.message });
      continue;
    }
    const reasons = validate(response, teaching, askedDirectQuote);
    attemptsLog.push({ attempt, length: response.length, reject_reasons: reasons });
    if (reasons.length === 0) {
      finalAnswer = response;
      finalAttempt = attempt;
      break;
    }
  }

  // Step 3 — if all 3 failed → verbatim fallback
  if (!finalAnswer) {
    const verbatim = pickBestParagraph(teaching, question);
    if (verbatim) {
      const attribution = `\n\n— Pulled from: ${teaching.sermon} (verbatim — no AI rewrite, all 3 voice checks failed)`;
      console.log('[GP73 FALLBACK]', JSON.stringify({ ts: new Date().toISOString(), question, sermon: teaching.sermon, attempts: attemptsLog }));
      return res.status(200).json({
        source: 'answer-v1',
        answer: verbatim + attribution,
        pulled_from: teaching.sermon,
        fallback: true,
        attempts: 3,
        reject_reasons: attemptsLog.map(a => a.reject_reasons || []).flat(),
        elapsed_ms: Date.now() - t0,
      });
    }
    // No teaching retrieved AND all 3 attempts failed — return a hard error
    return res.status(200).json({
      source: 'answer-v1',
      answer: 'I could not produce an answer that matched the voice rules and could not retrieve a sermon excerpt to quote. Try a more specific question.',
      pulled_from: null,
      fallback: true,
      attempts: 3,
      reject_reasons: attemptsLog.map(a => a.reject_reasons || []).flat(),
      elapsed_ms: Date.now() - t0,
    });
  }

  // Success — append citation, return
  const sermonName = teaching ? teaching.sermon : null;
  const answerWithCitation = sermonName
    ? `${finalAnswer}\n\nPulled from: ${sermonName}`
    : finalAnswer;
  return res.status(200).json({
    source: 'answer-v1',
    answer: answerWithCitation,
    pulled_from: sermonName,
    fallback: false,
    attempts: finalAttempt,
    elapsed_ms: Date.now() - t0,
  });
}
