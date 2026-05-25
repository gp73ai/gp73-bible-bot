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
// 3b. SOURCE AUTHORITY HIERARCHY — HARD-TIER PREFERENCE  (revised 2026-05-25)
//
// Retrieval is AUTHORITY-DRIVEN, not similarity-driven. The tiers below are
// walked in order; the first tier with a qualifying match wins. Pure
// semantic similarity only breaks ties WITHIN a tier — never ACROSS tiers.
// A 0.40-similarity transcript chunk beats a 0.95-similarity PDF chunk.
// This implements the doctrine: "authority over closeness."
// ============================================================
const SOURCE_BOOSTS = {
  'Obsidian-Core':             1.00,  // future: curated authoritative tier (RESERVED — Chief's doctrine, tone, declarations)
  'Sermon-Transcript-Whisper': 0.30,  // clean spoken Chief from 305 sermons
  'PDF Upload':                0.00,  // existing baseline (PDF-noisy last-resort)
};
// Ordered authoritative source list (highest authority first)
const TIER_ORDER = Object.entries(SOURCE_BOOSTS)
  .sort(([,a],[,b]) => b - a)
  .map(([src]) => src);

// SPEAKER FILTER — exclude Apostle Angela's content from retrieval until
// Chief's tone layer stabilizes. THREE layers of detection:
//   (1) transcript chunks: driveFileId starts with 'angela-' (always Angela)
//   (2) Option C: Title contains 'Apostle Angela' (catches name in title)
//   (3) Option D: PDF rows whose Title matches the known Angela-authored list
//       below. SCOPED to Source='PDF Upload' so Chief's transcripts with
//       collision titles (e.g. "Assassination Attempt", "Unstuck") aren't
//       wrongly filtered — driveFileId='sedrick-...' protects them.
//
// ANGELA_TITLES sourced 2026-05-25:
//   160 unique titles from Supabase PDF rows where Content matched 'Apostle Angela'
//    34 podcast titles from angela-episodes.json
//   194 unique after union
// Regeneratable by re-running the discovery script — keep this list in sync.
const ANGELA_TITLES = new Set([
  '2 Blind 2 See: Attitude, Reverence, and Spiritual Sight Before God',
  '99 & 1/2 Won’t Do: Kingdom Testing, Full Responsibility, and Doing More Than Enough',
  'A Heart of Truth: God Looks at the Heart, Not the Outward Appearance',
  'Almost Ain’t Good Enough: Faith, Dominion, and Refusing to Faint',
  'Are You Fit for the Kingdom of God? Part 2',
  'Are You Fit for the Rigorous Demands of the Kingdom of God?',
  'Are You Insured for Heaven? Salvation as the Only Eternal Coverage',
  'Assassination Attempt',
  'Built to Last: God’s Construction Process for Durable Believers',
  'Built to Last: God’s Construction Process for Durable Kingdom People',
  'By Their Fruit: Identifying and Removing Bad Roots',
  'By Their Fruits Pt. 2: Exposing the Root of the Strongman',
  'Can You Be Trusted? Solid Character and Faithfulness Under Trial',
  "Can't Touch This",
  'Check Your Foundations Before You Build in the Kingdom',
  'Choose Him Pt. 2: Becoming the Son Who Lives by the Word',
  'Choose Him: The Necessity of Deliberate Obedience Over Giftedness',
  'Choose Him: Why Obedience, Not Gifts, Proves You Belong to God',
  'Choosing God: The Marks of a True Son Who Lives by the Word',
  'Choosing to Grow: Laws of Intentional Spiritual Development',
  'Choosing to Produce: From Fig Tree Mentality to Faith-Filled Fruitfulness',
  'Choosing to Produce: Fruit, Faith, and Cutting Off the Flesh',
  'Choosing to Produce: The Laws of Fruitfulness and Dominion',
  'Church Gone Wild Pt. 2: No More Wilding Out and the Call to Stiff-Necked Repentance',
  'Church Gone Wild: Kingdom Relationship Requires Obedient Servanthood, Not Religious Familiarity',
  'Church Gone Wild: Kingdom Servanthood, Obedience, and the Rejection of Rebellion',
  'Churchless Faith: Belief Without Boundaries',
  'Clean My Heart: Building a Godly Foundation Through the Word and Kingdom Laws',
  'Clean My Heart: Building a Kingdom Foundation Through the Word',
  'Destroying the Stronghold: Taking Back the Mind',
  'Destroying the Stronghold: Winning the Wars of the Mind and Soul',
  'Developing Leaders Through Honor and Effective Witnessing',
  "Don't Settle",
  'Don’t Waste Your Wilderness: Faith as Substance in Testing, Identity, and Obedience',
  'Don’t Waste Your Wilderness: God Uses Pressure to Form Obedience, Dependence, and Kingdom Readiness',
  'Ears That Can Hear: Training the Ear to Receive Truth, Correction, and Kingdom Word',
  'Ears That Can Hear: Training the Inner Ear for Conversion, Correction, and Kingdom Truth',
  'Eyes That Can See: Spiritual Sight, Kingdom Mysteries, and the Glory of God',
  'Fight To Be Faithful',
  'Fight to Be Faithful: Honor, Loyalty, and Character in the Kingdom',
  'Fight to Be Faithful: Honor, Loyalty, and Kingdom Character',
  'Find the Missing Keys: Kingdom Authority, the First Adam, and the Last Adam',
  'For No Reason at All: Seasons, Sent Anointing, and Divine Election',
  'From Pain to Purpose: God Uses Pressure, Offense, and Delay to Produce Glory',
  'Frustrated Grace: How Disobedience, Poor Stewardship, and Rebellion Block Kingdom Increase',
  'Fueled by Faith',
  'Get Up Again',
  'Gift vs. Curse: Fulfilling God’s Assignment for Your Life',
  'God Is God: Simplicity, Immutability, and Refusing Religious Complication',
  'God Solves the Human Heart Problem Through Creation, Covenant, and Christ',
  'God as the Problem Solver: Creation, the Heart, and the New Birth',
  'God of Order: Kingdom Order, Rank, and Service in the House of God',
  "God's Calling You Higher: There’s Another Level",
  'He Can Heal',
  'He’s the God of My IF: Surrendering Conditions to Receive God’s Then',
  'How Excellent Is Thy Name: The Kingdom Laws of More and an Excellent Spirit',
  'How Excellent Is Thy Name: The Kingdom Laws of More and the Spirit of Excellence',
  'Hungry Yet? The Kingdom Test of Hunger, Character, and Faith',
  'Hungry Yet? The Test of True Hunger and Fruitfulness',
  "I'm Just a Nobody",
  'Ichabod: The Curse of Neglect and the Call to Prioritize God’s House',
  'Ichabod: The Curse of Neglect and the Priority of God’s House',
  'If Walls Could Talk',
  'If the Foundations Are Destroyed: The Heart, Sin, and the Laws of Salvation',
  'If the Foundations Be Destroyed Pt. 3: The Wrong Love',
  'If the Foundations Be Destroyed Pt. 4: What’s Love Got to Do With It?',
  'If the Foundations Be Destroyed Pt. 5: Loving God the Right Way',
  'If the Foundations Be Destroyed: Be My Valentine',
  'In God We Trust',
  'In Spirit and In Truth: Kingdom Revelation, Offense, and the Test of True Worship',
  'Intentional Growth, Stewardship, and Breaking the Jericho Wall',
  "It's Time 2 Bust A Move",
  "It's a Thin Line: Loving God the Wrong Way",
  'It’s My Time Pt. 2: Understanding Seasons, Timing, and Kairos',
  'It’s My Time: Time, Preparation, and Divine Endorsement',
  'I’m A Soldier Pt. 2: Soldier Faith, Rank, and Authority in the Kingdom of God',
  'I’m A Soldier: Chosen for Kingdom Warfare and Spiritual Rank',
  'I’m Gifted Pt. 2: The Gift vs. The Curse',
  'I’m Gifted: Stewarding God’s Loaned Gifts for His Purpose',
  'I’m Just Doing My Job: Hidden Rebellion, Discernment, and Obedience in the Kingdom',
  'I’m Just a Nobody: Humility, Purpose, and God’s Process in Saul’s Conversion',
  'Just Do Your Job: God-Assigned Roles, Government, and Order in the Church',
  'Laws to Uncover the Truth: Rightly Dividing the Spirit of the Word',
  'Let Me Upgrade You',
  'Living Life Un-offended',
  'Living Life Without Expectations',
  'Living Un-Offended: Overcoming Entitlement, Immaturity, and Offense Through Honor and Love',
  'Living Unoffended: Overcoming Offense, Entitlement, and Immaturity Through Kingdom Relationships',
  'Lord of the Underdog: Go in the Strength You Have',
  'Loving God the Right Way Through Sanctification of Heart, Soul, and Mind',
  'Loving God the Right Way Through Sanctified Heart, Soul, and Mind',
  'Loving God the Right Way: Heart, Humility, and True Worship',
  'Loving God the Wrong Way: It’s a Thin Line',
  'Loving God the Wrong Way: True Worship, Heart Devotion, and the Test of Success',
  'Need a Light? Pt. 2: Authority, Power, and the Light of Life',
  'Need a Light? Understanding Christ as the True Light and the Call to Walk in Light',
  'Never Bow Down',
  'Never Bow Down Through the Fire: Mastering the Soul Under Trial',
  'Never Bow Down Through the Fire: Mastering the Soul by the Word',
  'Never Bow Down: Refusing Pressure, Idols, and Sifting to Stand in Faith',
  'Never Bow Down: Refusing Pressure, Sifting, and Conformity to Stand in Faith',
  'Never Bow Down: Refusing Pressure, Sifting, and Idolatry to Stand in Faith',
  'Nevertheless',
  'Nevertheless: Surrendering the Will to Obey God',
  'No Empty Hands: The Law of Honor in Giving Before God',
  'No Games Just Flames',
  'Not My Will, But His Purpose',
  'Not My Will, Part 2: His Purpose and the Power of God’s Will',
  "Not My Will: Overcoming the Old Man Through Submission to God's Will",
  'Not My Will: Overcoming the Old Man Through the Will of God',
  "Obedience Beyond Preference: The Test of Hearing and Keeping God's Word",
  'Ordination as Divine Calling, Church Endorsement, and Spirit-Led Ministry Development',
  'Out of the Box: Belief Without Boundaries',
  'Playing in Gray Areas',
  'Problem Solver II: Lord Fix My Heart',
  'Problem Solver II: Lord, Fix My Heart',
  'Purpose Over Everything: Called According to His Purpose',
  "Purpose Over Everything: God's Word, God's Will, and Non-Negotiable Parameters",
  'Pursuing Righteousness',
  'Pursuing Righteousness: Submission, Obedience, and Kingdom Access',
  'Qualified for a Miracle',
  'Qualified for a Miracle: Faith, Private Obedience, and Kingdom Multiplication',
  'Qualified for a Miracle: Positioning for Multiplication Through Faith, Action, and Kingdom Expansion',
  'Quitters Never Win',
  'Ready, Set, Grow: Positioning for 2026 Through Closure, Focus, and Commitment',
  'Recover All: Pursue, Recover, and Restore What Was Lost',
  'Reinforcing the Right Mind: Taking Back Dominion Over Thought, Soul, and Peace',
  'Reinforcing the Right Mind: Taking Every Thought Captive to Christ',
  'Rise Up: Stewarding God-Given Gifts for Kingdom Purpose',
  'Roll Back The Stone',
  'Roll the Stone Away: Laws of Resurrection, Response, and Kingdom Access',
  'Silence Is Not Absence: Kingdom Laws for Holding Position in the Storm',
  'Storms Of Life',
  'Storms of Life: Building Peace, Faith, and Spiritual Authority in the Storm',
  'Street Call Straight',
  'The Art of Choosing Pt 7',
  'The Art of Choosing Pt. 4: Choosing His Way',
  'The Art of Choosing Pt.6',
  'The Assassination Attempt: Protecting the Development of the Son in You',
  'The Blessing of Brokenness: How God Uses Grief, Pressure, and Surrender to Release Greater Fruit',
  "The Blessing of Brokenness: How Jesus' Grief, Breaking, and Compassion Release Ministry",
  'The Christ Mind: Overcoming the War for the Soul Through Kingdom Thinking',
  'The Christ Mind: Winning the War for the Believer’s Mind and Soul',
  'The Dangers of Hoarded Growth: Me, Myself & I and the Kingdom Law of Circulation',
  'The Dangers of Hoarded Growth: Me, Myself, and I vs Kingdom Circulation',
  'The Gift and the Curse: Receiving Blessing Without Losing the Word',
  'The Last Laugh: God’s Favor, Word, and Judgment',
  'The Last Laugh: God’s Word, Rank, and the Fear of the Lord',
  'The Law You Cannot Pray Around: Structural Kingdom Laws and the Harvest',
  'The Law You Cannot Pray Around: The Laws of the Harvest',
  'The Mishandled God: Reverence, Grace, and the Fear of the Lord',
  'The Mishandled God: Reverence, Rank, and the Danger of Irreverent Access',
  'The Power Of Geneosity',
  'The Power of Connecting to a God-Led Vision',
  'The Power of Your Yes: Obedience, Alignment, and Kingdom Response',
  'The Purpose for the Call: Called According to His Purpose',
  'The Strategic God',
  'The Strategic God: How God Uses Process, Leadership, and Obedience to Prepare for Promotion',
  'There Is A Test In My Testimony',
  'There’s Another Level: Apostolic Growth, Good Soil, and the High Calling',
  'This Ain’t Burger King: God’s Way, Not Consumer Christianity',
  'Time 2 Rise Up: Jesus Interrupts Settling and Calls the Impotent to Wholeness',
  'To Obey: Why Obedience Matters More Than Sacrifice',
  'Unapologetic: Living Without Regret, Fear, or Distraction in God’s Assignment',
  "Unbreakable: I Won't Break, You Won't Break",
  'Understanding Your Assignment',
  'Unfinished Pt. 2: The Potter, the Builder, and the Approval Process',
  "Unfinished Pt. 2: The Potter, the Last Adam, and the Approval Process for Building God's House",
  'Unfinished Pt. 3: Check Your Foundations for Kingdom Approval',
  'Unfinished Pt. 4: Your Foundations Matter',
  'Unfinished Pt.4: Your Foundations Matter',
  'Unfinished: The Fear of the Lord, the First Adam, and the Work of Building in Christ',
  'Unfinished: The Fear of the Lord, the First Adam, and the Work of the Last Adam',
  'Unqualified But Called: God Chooses by the Heart, Not Human Qualifications',
  'Unstuck',
  'Walls Fall Down: Breaking Spiritual Strongholds Through Faith, Obedience, and the Voice of God',
  'Walls Fall Down: Faith, Process, and Breakthrough at Jericho',
  'What Do You See? Prophetic Sight, Faith, and the Battle for Spiritual Perception',
  'What If: God Is the God of My If',
  "What's love got to do with it",
  'What’s Done in the Dark Pt. 2: From Salvation to Sonship and Direct Access',
  'What’s Done in the Dark: Sonship, Light, and the War Against Hidden Darkness',
  'What’s Love Got to Do with It? Loving God with Heart, Soul, and Mind',
  'When Everything Shifts: From Manna to New Authority',
  'When Everything Shifts: Moving from Manna to New Authority',
  'When Faith Comes: Hearing, Watching, and the Works That Release Kingdom Power',
  'When Faith Comes: Watching, Hearing, and Acting in the Fourth Watch',
  'When Faith Comes: Watching, Hearing, and Responding in the Fourth Watch',
  'When Faith Comes: Watching, Hearing, and Working Faith Into Manifestation',
  'When Faith Comes: Watching, Hearing, and Working Until Faith Manifests',
  'When Faith Comes: Watching, Hearing, and Working Until Kingdom Faith Appears',
  'Winning Wars Within',
  'Winning through my Weakness',
  'You Shall Not Fail: Turning Failure into Faith, Humility, and Glory',
]);

function isAngelaRow(row) {
  const id = (row.driveFileId || row.drivefileid || row.drive_file_id || '');
  const title = row.Title || row.title || '';
  const source = row.Source || row.source || '';
  // (1) transcript chunks tagged 'angela-…' — most reliable, transcript-side
  if (/^angela[-_]/i.test(id)) return true;
  // (2) Option C — Title literally names Apostle Angela
  if (/Apostle Angela/i.test(title)) return true;
  // (3) Option D — PDF rows whose Title matches the curated Angela list.
  // Scoped to Source='PDF Upload' so Chief's transcripts with collision
  // titles ('Assassination Attempt', 'Unstuck', 'Unqualified But Called',
  // 'Never Bow Down') are NOT wrongly filtered.
  if (source === 'PDF Upload' && ANGELA_TITLES.has(title)) return true;
  return false;
}

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
  // Pull a wide candidate pool (50) so the hard-tier walk has room across all sources.
  const url = `${process.env.SUPABASE_URL}/rest/v1/documents?select=id,Title,Content,Summary,core_principles,Category,Source,driveFileId&or=(${conds.join(',')})&limit=50`;

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

    // Universal: filter Angela and require real keyword relevance (>= 2 weighted hits)
    const eligible = rows
      .filter(row => !isAngelaRow(row))
      .map(row => {
        const title = (row.Title || '').toLowerCase();
        const summary = (row.Summary || '').toLowerCase();
        let kwScore = 0;
        for (const t of terms) {
          if (title.includes(t)) kwScore += 3;
          if (summary.includes(t)) kwScore += 1;
        }
        return { row, kwScore };
      })
      .filter(s => s.kwScore >= 2);

    if (!eligible.length) return null;

    // HARD-TIER WALK: try each authoritative source in order; first tier with a
    // qualifying match WINS. Within a tier, highest keyword score breaks the tie.
    for (const tier of TIER_ORDER) {
      const inTier = eligible
        .filter(s => s.row.Source === tier)
        .sort((a, b) => b.kwScore - a.kwScore);
      if (inTier.length) {
        const top = inTier[0];
        return {
          source: 'layerA-keyword',
          sermon: top.row.Title || 'Untitled',
          content: top.row.Content || top.row.Summary || '',
          summary: top.row.Summary || '',
          category: top.row.Category || '',
          score: top.kwScore,
          doc_source: top.row.Source || 'unknown',
          tier_used: tier,
        };
      }
    }
    // Eligible rows exist but none belong to a known tier — last-resort, highest kw
    eligible.sort((a, b) => b.kwScore - a.kwScore);
    const top = eligible[0];
    return {
      source: 'layerA-keyword',
      sermon: top.row.Title || 'Untitled',
      content: top.row.Content || top.row.Summary || '',
      summary: top.row.Summary || '',
      category: top.row.Category || '',
      score: top.kwScore,
      doc_source: top.row.Source || 'unknown',
      tier_used: 'unknown',
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
      // Wide candidate pool (50) — hard-tier walk needs room across all sources
      body: JSON.stringify({ query_embedding: embedding, match_count: 50 }),
    });
    if (!r.ok) return null;
    const docs = await r.json();
    if (!Array.isArray(docs) || !docs.length) return null;

    // Universal filter: drop Angela rows + enforce minimum similarity threshold
    const eligible = docs
      .filter(d => !isAngelaRow(d))
      .filter(d => (d.similarity || 0) >= 0.35);
    if (!eligible.length) return null;

    // HARD-TIER WALK: walk authoritative sources in order. First tier with any
    // qualifying match WINS. Within a tier, highest similarity breaks ties.
    // A 0.40 transcript chunk beats a 0.95 PDF chunk — by design.
    for (const tier of TIER_ORDER) {
      const inTier = eligible
        .filter(d => (d.Source || d.source) === tier)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      if (inTier.length) {
        const top = inTier[0];
        return {
          source: 'layerB-embedding',
          sermon: top.Title || top.title || 'Untitled',
          content: top.Content || top.content || '',
          summary: top.Summary || top.summary || '',
          category: top.Category || top.category || '',
          similarity: top.similarity,
          doc_source: top.Source || top.source || 'unknown',
          tier_used: tier,
        };
      }
    }
    // Eligible rows but none in a known tier — last-resort highest similarity
    eligible.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    const top = eligible[0];
    return {
      source: 'layerB-embedding',
      sermon: top.Title || top.title || 'Untitled',
      content: top.Content || top.content || '',
      summary: top.Summary || top.summary || '',
      category: top.Category || top.category || '',
      similarity: top.similarity,
      doc_source: top.Source || top.source || 'unknown',
      tier_used: 'unknown',
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

  // Rule 7: must contain at least one bold declarative starting with one of the allowed
  // teaching openers (no modal verb in first 4 words).
  // RELAXED 2026-05-23: added When/Because/If/Faith/Christ/Word/Truth — real teaching
  // doesn't always start with You/That/God/The.
  const sentences = r.split(/[.!?]/).map(s => s.trim()).filter(Boolean);
  let foundDeclarative = false;
  for (const s of sentences) {
    if (/^(You|That|God|The|When|Because|If|Faith|Christ|Word|Truth)\s+/.test(s)) {
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

  const cleanedForLLM = teaching && teaching.content ? cleanContent(teaching.content).slice(0, 4000) : '';
  const teachingBlock = cleanedForLLM
    ? `\n\nTEACHING CONTEXT (you MUST quote at least one 8-word phrase from this word-for-word):\n[Sermon: ${teaching.sermon}]\n${cleanedForLLM}`
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
// 10a. CONTENT NORMALIZER — strip metadata noise from raw PDF extracts
//
// ADDED 2026-05-23: Supabase `documents.Content` carries PDF artifacts
// (phone, email, sermon headers, standalone verse-number tokens). This
// pre-processor cleans them so:
//   - the LLM sees teaching text without noise (better quoting)
//   - the verbatim fallback never leaks phone/email to the user
// Actual scripture and teaching content is preserved.
// ============================================================
function cleanContent(text) {
  if (!text) return '';
  let c = text;
  // strip US phone numbers — (407) 744-5122, 407-744-5122, 407.744.5122, 4077445122
  c = c.replace(/\(?\b\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g, '');
  // strip email addresses
  c = c.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '');
  // strip standalone date stamps  MM-DD-YY / MM-DD-YYYY / MM/DD/YY / MM/DD/YYYY
  c = c.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '');
  // strip sermon-header identity lines (ministry / author headers — NOT scripture)
  c = c.replace(/^.*(City of Life Ministries|Godsprisoner|Apostle Sedrick|Apostle Angela|Dr\.\s+Sedrick).*$/gmi, '');
  // strip standalone verse-number tokens left over from PDF extraction
  //   e.g. "Jhn 5:26-\n26\nFor as the Father…" → drops the lone "26"
  c = c.replace(/^\s*\d{1,3}-?\s*$/gm, '');
  // collapse 3+ newlines → 2; collapse runs of spaces/tabs → single space
  c = c.replace(/\n{3,}/g, '\n\n');
  c = c.replace(/[ \t]{2,}/g, ' ');
  // strip lines that are now empty after substitutions
  c = c.split('\n').filter(line => line.trim().length > 0 || c.indexOf(line) === c.lastIndexOf(line)).join('\n');
  return c.trim();
}

// ============================================================
// 10b. VERBATIM FALLBACK — zero LLM, paragraph from sermon as-is
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
//
// FIX 2026-05-23: only trigger strict no-commentary mode when the user
// asks for a SPECIFIC verse. Topic questions like "what does the Bible
// say about faith" are NOT direct-quote requests — they want an answer.
// ============================================================
const KJV_BOOK_REF = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d+:\d+/i;

function isDirectQuoteAsk(question) {
  const q = question.toLowerCase();
  // Trigger 1: explicit verb-based ask
  if (/\b(quote|recite)\b/.test(q)) return true;
  if (/\bread me\b/.test(q)) return true;
  if (/\bgive me the (verse|scripture|text)\b/.test(q)) return true;
  // Trigger 2: explicit Book Chapter:Verse reference (e.g. "what does John 3:16 say")
  if (KJV_BOOK_REF.test(q)) return true;
  return false;
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

  // Step 3 — if all 3 failed → verbatim fallback (cleaned of metadata noise)
  if (!finalAnswer) {
    const rawParagraph = pickBestParagraph(teaching, question);
    const verbatim = cleanContent(rawParagraph || '');
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
