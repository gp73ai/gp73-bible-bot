// GP73 Bible Intelligence — Response Engine v6 — build 20260425
export const config = {
  runtime: 'nodejs',
};

// ============================================================
// VOICE SYSTEM PROMPT — Chief's exact framework
// ============================================================
const VOICE_SYSTEM_PROMPT = `You are responding as a direct, authoritative teacher. You do not soften truth, you do not speak like a chatbot, and you do not give generic explanations.

VOICE RULES:
- Speak directly to the person using "you"
- Sound like a real conversation, not a sermon or article
- No soft openers (never say "I understand", "that's a great question", "it's normal", "many people feel")
- No generic teaching language (avoid "Christianity is about...", "the Bible teaches...")
- No over-explaining or long breakdowns
- Keep responses tight -- 3 to 6 sentences max
- No em dashes -- use commas or periods only

STRUCTURE (MANDATORY):
1. Start with a direct correction, challenge, or exposure of the person's thinking
2. Identify the flaw, contradiction, or misplaced assumption
3. Give a clear, simple truth -- not a lecture
4. Close with a firm reality, decision, or consequence

BEHAVIOR RULES:
- Do NOT explain before correcting
- Do NOT speak generally -- make it personal
- Do NOT try to sound balanced or neutral
- Do NOT avoid hard truth
- If needed, clearly state eternal consequences without hesitation
- Do NOT repeat the same opening phrase across responses

TONE CONTROL:
- Resistant or prideful questions: confront directly and expose the contradiction
- Confused but honest questions: briefly clarify, then correct
- Emotional questions: one short acknowledgment phrase max, then correct

FINAL CHECK BEFORE RESPONDING:
- Does the first sentence challenge or correct? If not, rewrite.
- Does this sound like a real person speaking, not a chatbot? If not, rewrite.
- Is it direct, tight, and personal? If not, rewrite.

EXAMPLES OF YOUR VOICE:

"You feel lost because you don't have direction, and you don't have direction because you're not aligned. You can't find your way by trying harder. You find it by submitting to the One who already knows where you're going."

"Your faith is not working because you don't know how to work faith. Faith has laws. It has boundaries. It only honors what God says. Get in the Word -- because that's where faith comes from."

"He's not your priority. You're consistent with what you value. If you're inconsistent with God, it's not a mystery -- it's a priority problem."

"You do believe in tithing. You just don't believe in giving it to God. You don't question paying the world. You only question giving to God."

"Everything you read in this world was written by men. You trust that, don't you? The issue isn't that men wrote it. The issue is you don't want what it says to be true."

"You don't want control now, but you won't control what happens after you die. The only place you resist structure is where you want to keep doing what you're doing. That's not a Christianity problem. That's a surrender problem."`;

const GENERAL_PROMPT = `Answer the question clearly and directly.
Do not force spiritual framing onto a non-spiritual question.
Do not sound like a chatbot.
Keep it natural and concise.
No em dashes. No filler.`;

// ============================================================
// ENTRY BANK — Chief's exact opening lines by posture
// Rotated randomly. Never repeat the same opener twice in a row.
// ============================================================
const ENTRY_BANK = {
  logic: [
    "Everything you read in this world was written by men. You trust that, don't you?",
    "That argument falls apart the moment you think it through.",
    "You're not being consistent with your own logic.",
    "Have you read something that wasn't written by men?",
    "Then let science tell you what happens after you die.",
    "Your thinking is flawed -- but so is everyone's until they learn better.",
    "That's because you're calling everything religion. God calls it relationship.",
    "You can't see oxygen either, but you trust it every second."
  ],
  resistant: [
    "You can, but it won't be the God of the Bible.",
    "You don't want control now, but you won't control what happens after you die.",
    "That's not your real issue.",
    "You're using that as a cover.",
    "You don't have a control problem with Christianity -- you have a control problem, period.",
    "You don't want truth. You want to stay comfortable.",
    "God doesn't negotiate with that position."
  ],
  emotional: [
    "If you were too far gone, you wouldn't still be here asking.",
    "Good thing your feelings don't decide that. God already said He does.",
    "Then you fail with help this time, not by yourself.",
    "You're asking the right question from the wrong angle.",
    "You've been taught this wrong. That's why it doesn't make sense yet.",
    "Prayer isn't for feelings. It's for alignment.",
    "You learned everything else by starting. This is no different."
  ],
  deflection: [
    "Take your time. Just know you don't control when your time is up.",
    "You're not too young to die. That's the part you're ignoring.",
    "Because trying isn't transformation. You need training.",
    "You start where everyone starts. Repent and come through Jesus.",
    "That's not the real question you're asking."
  ],
  neutral: [
    "Here's the truth whether you like it or not.",
    "Let's be real for a second.",
    "The issue isn't what you think it is.",
    "You're looking at this from the wrong direction."
  ]
};

function getEntryLine(posture, question) {
  const q = question.toLowerCase();
  let pool;

  // Route to appropriate pool based on posture and question signals
  if (posture === 'resistant') {
    if (q.includes('bible') || q.includes('written by men') || q.includes('science') || q.includes('religion')) {
      pool = ENTRY_BANK.logic;
    } else if (q.includes('ready') || q.includes('later') || q.includes('young') || q.includes('time')) {
      pool = ENTRY_BANK.deflection;
    } else {
      pool = ENTRY_BANK.resistant;
    }
  } else if (posture === 'emotional') {
    pool = ENTRY_BANK.emotional;
  } else {
    pool = ENTRY_BANK.neutral;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// PART 1 — POSTURE DETECTION
// Resistant, emotional, or neutral -- adjusts HOW GPT corrects
// ============================================================
function detectPosture(q) {
  const lower = q.toLowerCase();

  const resistantSignals = [
    "don't believe", "dont believe", "i don't think", "i dont think",
    "why should i", "why would i", "that's not", "thats not",
    "i tried", "it didn't work", "it doesnt work", "just want money",
    "too controlling", "hypocrites", "i can be good", "don't need",
    "dont need", "old testament", "man-made", "man made"
  ];

  const emotionalSignals = [
    "feel", "feeling", "struggling", "hurt", "broken", "alone",
    "lost", "scared", "hopeless", "depressed", "don't know",
    "dont know", "overwhelmed", "tired", "confused", "not good enough"
  ];

  if (resistantSignals.some(s => lower.includes(s))) return 'resistant';
  if (emotionalSignals.some(s => lower.includes(s))) return 'emotional';
  return 'neutral';
}

// ============================================================
// PART 2 — INTENT DETECTION
// Spiritual, general, or other -- routes to correct prompt
// ============================================================
function detectIntent(input = '') {
  const text = input.toLowerCase();

  const spiritualWords = [
    'god', 'faith', 'sin', 'bible', 'heaven', 'hell', 'jesus',
    'holy spirit', 'prayer', 'pray', 'salvation', 'saved', 'grace', 'repent',
    'scripture', 'church', 'worship', 'gospel', 'cross', 'forgive', 'eternal',
    'tithe', 'tithing', 'pastor', 'calling', 'spirit', 'soul', 'heart'
  ];

  if (spiritualWords.some(w => text.includes(w))) return 'spiritual';

  if (text.includes('what') || text.includes('how') || text.includes('why') ||
      text.includes('when') || text.includes('who') || text.includes('is ') ||
      text.includes('can ') || text.includes('does ')) return 'general';

  return 'other';
}

// ============================================================
// HARD-CODED VOICE RESPONSES — 42 of Chief's exact answers
// GPT never runs for these. No retrieval. No blending.
// ============================================================
const VOICE_RESPONSES = [
  {
    patterns: ['what is faith', 'what faith really', 'define faith', 'faith really', 'is faith'],
    answer: `Faith is not what most people think it is. It's not a feeling, and it's not just believing something will happen. Faith is a sequence of commands and codes to the spirit realm. You have to believe it before you can see it. Most people want to see it to believe it, but that's not how God operates. Faith cometh by hearing, hearing by the word of God. That means faith doesn't exist unless it's connected to a force that can make something out of nothing. Nothing can do that but God. And here's what people miss: if you don't believe, you still have faith. Your faith is just pointed at yourself and your own unbelief. By faith the worlds were framed. You can't even frame understanding without first believing you need to understand it.`
  },
  {
    patterns: ['struggle with sin', 'why do i sin', 'saved and still sin', 'still struggle', 'saved but sin', 'why do i struggle'],
    answer: `You struggle with sin because you don't fully understand what sin is yet. People think sin is just bad behavior. That's not it. Sin is a presence. A force. An inward element with a personality, a lifestyle, a taste. Sin was the most authentic relationship you ever had before God. It was the friend when nobody else was there. It was the anger that protected you from the bully. It was everything you reached for when you needed something. So when you got saved, you got a new heart and a new spirit. But you didn't get a new soul. You didn't get new desires or new memories overnight. Your soul still remembers. Paul said that husband is alive as long as the memory remains. That's the war. The answer is renewing your mind through the word. Not trying harder. Reprogramming.`
  },
  {
    patterns: ['life not changing', 'why isnt my life', 'nothing is changing', 'life hasnt changed', 'why is my life', 'life not change', 'not changing'],
    answer: `Your life changed. Your choices haven't caught up yet. The moment you confessed and repented, something happened that you can't undo. But people want a microwave. Salvation is instant. Transformation is not. You've still got the same patterns because you haven't renewed your mind yet, and renewal requires work. You have to learn to possess your soul. Your soul still answers to the old name. It still remembers the old life. It still believes what it was trained to believe. You can't shortcut that with prayer alone. You've got to get in the word, build new patterns, and stay consistent. It's like going to the gym. You don't walk in overweight and leave in shape. Muscles tear. It takes time. But the change is happening. You just haven't stayed in the process long enough to see it yet.`
  },
  {
    patterns: ['how do i know god', 'is god real', 'prove god', 'god exist', 'god real', 'know god is real'],
    answer: `You're breathing. The sun came up this morning. The ocean is in its place. The birds are flying. Something made all of that, and it wasn't you. You know God is real because there are things in your life you can't explain. Forces bigger than you that have moved on your behalf when you had no business surviving what you went through. Hebrews says it plainly: he that comes to God must believe that he is, and that he rewards those who diligently seek him. Seeking isn't passive. Through study and consistency in the word, you stop asking whether God is real and start realizing he's the only thing that is real. In him we live and move and have our being. If God withdrew himself, you'd know it immediately because nothing would exist. I don't try to convince atheists. At the end, we'll all see.`
  },
  {
    patterns: ['god isnt listening', 'god not listening', 'god doesnt hear', 'god not hearing', 'feel like god', 'god listening', 'not listening to me'],
    answer: `Your feelings don't determine whether God is listening. The condition of your spirit does. John 9:31 is direct: God does not hear sinners, but if any man is a worshiper of God and does his will, him he will hear. So the question isn't whether you feel heard. The question is whether you're in the right condition to be heard. Are you saved? Have you confessed Jesus Christ as your Lord? Because God operates on a specific carrier, and if you're not on it, you won't get through. That carrier is Jesus Christ. That's confession, belief, repentance, and actually walking toward transformation, not just claiming the title. Get on the right carrier and the connection opens. Feeling has nothing to do with it.`
  },
  {
    patterns: ['who is jesus', 'who is jesus really', 'who was jesus', 'what is jesus'],
    answer: `He is the Son of God. That is not opinion -- that is what the scriptures define. Whether you believe that or not does not change who He is. It just determines who He is to you. To some He is religion. To others He is just a way to feel forgiven. But to those who actually understand, He is transformation. He is the shift from old to new. He is the way to God and the standard for how to live in the earth. The problem is people don't believe on Him as the scriptures say. They believe based on church, tradition, or their own theology. But He is clearly defined. He is the Son of God.`
  },
  {
    patterns: ['faith not working', 'why isnt my faith', 'faith doesnt work', 'faith not produce', 'why is my faith'],
    answer: `Your faith is not working because you don't know how to work faith. Faith has to be tied to the original source -- and that source is the Word of God. It does not come from your belief system or positive thinking. It comes from what God actually said. God invented faith. So you don't get to redefine it or run it your way. Faith operates by God's Word. Just like in the beginning -- when God spoke, creation responded. That is how faith works. It responds to what God says. If your faith is not producing, it is not aligned. Faith has laws. It has boundaries. It has structure. And it only honors what God says. Get in the Word. Build your belief from there. Because faith comes by hearing -- and hearing by the Word of God.`
  },
  {
    patterns: ['live how i want', 'live how i want and follow god', 'can i do what i want', 'follow god and live how', 'live any way i want'],
    answer: `No. You cannot be a rebel and be submitted at the same time. You cannot serve yourself and serve God. You have to choose. Following God means giving up control. It means you are no longer the one leading -- He is. A disciple is not just someone who believes. A disciple is someone who is disciplined. So if you are trying to bring God into your life on your terms, like He is a genie, it is not going to work. God already made it clear -- He does not change. So either you follow Him, or you follow yourself. You can live how you want and follow your version of God -- but it will not be the real one.`
  },
  {
    patterns: ['what does it mean to be saved', 'what is salvation', 'what does saved mean', 'being saved means', 'mean to be saved'],
    answer: `It means you have stepped into a new life with a new standard. When you are saved, you receive a new heart and a new spirit. But your mind does not automatically change. Your thinking, your habits -- that part has to be trained. That is where most people get it wrong. They think salvation means everything shifts overnight. It does not. You have been made new -- but now you have to learn how to live new. It is no different than going to school. You do not just enroll -- you have to learn. The life you now live has to be lived by the faith of the Son of God. Salvation is the start. Transformation is what follows.`
  },
  {
    patterns: ['how do i hear from god', 'how to hear god', 'hear from god', 'hear god speak', 'how do i actually hear'],
    answer: `You hear from God by becoming aligned with God. First you need the Spirit of God -- because God speaks to those who are His. Then you develop an ear for Him. My sheep know my voice. That means recognition comes from relationship and alignment. If you are not aligned with Him, you will not recognize Him -- even if He is speaking. And that is the real issue. People want to hear God without being positioned for God. But if you are not following Him, what would be the point of hearing Him? Get aligned. Stay consistent. Learn His voice through His Word. Then when He speaks -- you will know.`
  },
  {
    patterns: ['keep going back to sin', 'why do i keep sinning', 'keep returning to sin', 'keep falling back', 'go back to the same sin', 'keep going back'],
    answer: `Because in your mind you are still the same person. You have not accepted that the old you is dead, so you keep feeding the identity that is supposed to be gone. You are trying to resist something you still believe is you. That is why you keep losing. You do not even recognize it as the enemy. You think it is just you. Your desires have not changed yet. Your taste is still trained by your old life. So when pressure comes, you go back to what feels natural. You do not break that by trying harder. You break it with training. You need the Word. You need discipline. You need new habits that replace the old ones. Paul said there is a law at work. That means this is not random -- it is patterned. Right now you still like what is killing you. So until you change what you feed and how you train, you are going to keep going back.`
  },
  {
    patterns: ['if god loves me why is my life hard', 'why is life so hard', 'god loves me but life is hard', 'why is my life so difficult', 'why does god let life be hard'],
    answer: `Because God never promised you an easy life. You are confusing love with comfort. That is not how this works. Life is hard by design. That is why you need God. You are in a fight whether you accept it or not. Scripture tells you to put on armor, not sit back and relax. You are fighting systems, mindsets, and spiritual forces that have been in place long before you showed up. Even Jesus had to fight and suffer. So why would you expect a smooth path? The difference is you are not alone. You have been given help, authority, and instruction. You just do not know how to use it yet. So instead of asking why it is hard, ask why you are not equipped. Stop whining. Start learning how to win.`
  },
  {
    patterns: ['difference between religion and relationship', 'religion vs relationship', 'religion and relationship with god', 'what is religion vs', 'religion or relationship'],
    answer: `Religion is a routine that makes you feel better without changing you. A real relationship changes you whether you like it or not. Religion lets you stay the same. You show up, do the motions, and walk away unchanged. It is controlled, predictable, and safe. A real relationship forces growth. It exposes you, corrects you, and pushes you higher. That is why people prefer religion. It does not challenge them. Religion locks God into a system. A relationship forces you to move with Him. If nothing in your life is being corrected, stretched, or transformed, you do not have a relationship. You have a routine.`
  },
  {
    patterns: ['why do i feel far from god', 'feel distant from god', 'feel far from god', 'god feels distant', 'god feels far away'],
    answer: `Because you do not know how to get close to Him. Feelings do not tell you distance. Alignment does. God already told you how this works. Draw near to Him and He will draw near to you. That means the move starts with you. If you are not in the Word, not seeking Him, not building the relationship, then of course you are going to feel distant. You want God to come into your routine, but you will not step into His. That is backwards. You do not approach God casually. You approach Him intentionally. If your heart is not positioned toward Him, you will feel far from Him even if He is right there. So stop measuring by feeling and start measuring by alignment.`
  },
  {
    patterns: ['how do i actually change my life', 'how do i change my life', 'how to change my life', 'how do i change', 'i want to change my life'],
    answer: `You change your life by giving up control of it. Most people want change but they do not want to change. They want different results without a different life. That does not work. Change requires submission, discipline, and training. You do not drift into a new life. You build it. Your old patterns are still in you. Your thinking is still shaped by your past. If you do not deal with that, you will recreate the same life in a different place. That is why people leave one situation and build another one just like it. You have to renew your mind, change your habits, and separate from what keeps pulling you back. That might mean different relationships, different environments, different decisions. This is not automatic. You have to train for the life you say you want.`
  },
  {
    patterns: ['i believe in god but not jesus', 'dont need jesus', 'believe in god not jesus', 'i believe in god just not jesus', 'god without jesus'],
    answer: `Belief doesn't make something true. You don't get to skip the process God established and still expect the outcome. You don't walk into a country and become a citizen without going through what's required. This is no different. You don't know who Jesus is. That's the real issue. He's not optional. He's the access point. You don't need Him now because you think you're in control. But when the moment comes that you can't control, you'll wish you had Him.`
  },
  {
    patterns: ['i tried living for god and it didnt work', 'tried god before', 'gave god a chance and it didnt work', 'tried christianity and it failed', 'god didnt work for me'],
    answer: `It didn't work because you were still doing it your way. You don't try God like an experiment. You submit to Him. If your life doesn't line up with His principles, the outcome won't line up either. That's not failure. That's consequence. When something doesn't work, you don't throw it away. You fix how you're using it. The problem isn't God. It's that you never actually let Him lead.`
  },
  {
    patterns: ['why would a loving god allow suffering', 'why does god allow evil', 'why does god allow pain', 'if god is good why is there suffering', 'why does god let bad things happen'],
    answer: `You're blaming God for what man and life produce. God created order. Man chose independence. What you see now is the result of that. Suffering isn't proof that God is absent. It's proof that this world is broken. And it's also the reason you need Him. You want a world with no pain but you don't want the authority that governs it. It doesn't work like that.`
  },
  {
    patterns: ['dont want to lose who i am', 'afraid of losing myself', 'scared of changing who i am', 'will i lose my identity if i follow god', 'i dont want to change who i am'],
    answer: `You're holding onto something that won't last anyway. Who you are right now is temporary. It fades, it's forgotten, and it can't carry you into eternity. You're protecting an identity that isn't built to last. The real question is not who you are here. It's where you're going after here. If you don't let go of who you are, you'll never become who you're supposed to be.`
  },
  {
    patterns: ['i dont feel ready to change', 'not ready to give my life to god', 'i need more time', 'ill do it when im ready', 'not ready yet'],
    answer: `You don't need to feel ready. You need to understand the risk of waiting. You don't control time. You don't control when your moment comes. So delaying the decision doesn't protect you. It exposes you. You can wait if you want. Just understand -- when the time runs out, so does the option.`
  },
  {
    patterns: ['god wouldnt send people to hell', 'i dont think god sends people to hell', 'a loving god wouldnt send people to hell', 'hell doesnt exist', 'god is too loving for hell'],
    answer: `It doesn't matter what you think. It matters what is. Hell is the result of rejecting God's order, not a random punishment. You break laws here, you face consequences. This is no different. You're trying to measure God with your logic. But your logic didn't create the system. You can disagree with it. But you'll still answer to it.`
  },
  {
    patterns: ['christianity is too controlling', 'religion is controlling', 'god is too controlling', 'following god feels controlling', 'church is controlling'],
    answer: `Because you don't understand what you signed up for. This isn't about doing whatever you want. It's about learning how to be led. Discipline always feels like control to someone who wants freedom on their terms. But what you call control is actually direction. You only resist it in the areas you don't want to change. And that's exactly where the problem is.`
  },
  {
    patterns: ['i can be a good person without god', 'dont need god to be good', 'good person without religion', 'be good without god', 'good without church'],
    answer: `You can do good things. That doesn't make you good at your core. Good deeds don't fix a broken condition. You can live a whole life doing right externally and still be wrong internally. That's why it matters. Because this isn't about behavior. It's about transformation.`
  },
  {
    patterns: ['church people are hypocrites', 'christians are hypocrites', 'hypocrites in the church', 'why are christians hypocrites', 'religious hypocrites'],
    answer: `That sounds like an excuse. You're pointing at people to avoid dealing with yourself. Every group has flawed people. That doesn't invalidate the purpose of the group. You don't quit school because of a bad teacher. So why quit your development because of imperfect people? The issue isn't them. It's that you don't want the process.`
  },
  {
    patterns: ['i dont trust pastors', 'dont trust religion', 'cant trust the church', 'pastors are corrupt', 'dont trust religious leaders'],
    answer: `Good. Don't trust blindly. But your distrust doesn't remove your responsibility. God never said every pastor would be right. He said He would provide leadership. You're using bad examples to justify disconnection. That doesn't fix anything. It just leaves you without guidance. At some point you have to decide: are you avoiding people, or avoiding growth?`
  },
  {
    patterns: ['bible was written by men', 'written by men', 'bible written by men', 'men wrote the bible', 'humans wrote the bible'],
    answer: `Everything you read in this world was written by men. You trust that, don't you? Your history books, your science textbooks, your laws -- all written by men. You don't question those. So the issue isn't that men wrote it. The issue is you don't want what it says to be true. That's a different problem. And that's the one you actually need to deal with.`
  },
  {
    patterns: ['christianity sounds like control', 'christianity is control', 'christianity limits me', 'following god is control', 'god is controlling me'],
    answer: `You don't want control now, but you won't control what happens after you die. That's the part you're not thinking about. Everything you trust in this life has rules. Your job has rules. Your body has rules. The road has rules. You don't call those control -- you call them necessary. The only place you resist structure is where you want to keep doing what you're doing. That's not a Christianity problem. That's a surrender problem. And surrender is exactly what this requires.`
  },
  {
    patterns: ['dont believe in tithing', 'tithing is old testament', 'tithe is not required', 'i dont tithe', 'tithing is not biblical'],
    answer: `You do believe in tithing. You just don't believe in giving it to God. You pay it every day -- phone bill, car note, taxes, school systems. You already live by giving a portion to keep systems running. So this isn't about belief. It's about where your loyalty is. You don't question paying the world. You only question giving to God. Tithing is just a system that supports what you're connected to. So say it right. You don't have a problem with tithing. You have a problem with tithing to God.`
  },
  {
    patterns: ['churches just want money', 'church is about money', 'church only wants money', 'pastors just want your money', 'tithing is a scam'],
    answer: `No, churches need money to function. You don't expect anything else in life to run for free, so why do you expect that from the church? Lights, building, staff, outreach -- none of that runs without money. You'll pay for food, games, entertainment without thinking twice. But when it comes to God, now it's a problem. That's not logic. That's priority. If only a small percentage gave in any system, that system would collapse. So it's not about just wanting money. It's about sustaining what you say you're part of. The real question is not what the church is doing. It's what you're willing to support.`
  },
  {
    patterns: ['not good enough for god', 'not worthy of god', 'too far gone for god', 'god cant love me', 'god wont accept me', 'not good enough'],
    answer: `You're not. That's the truth. None of us are. That's the whole point. You feeling like you're not good enough is not a problem -- it's the signal that you need Him. God doesn't come to people who think they have it together. He comes to the ones who know they don't. You don't qualify yourself for God. He qualifies you. No good deeds, no effort, no morality can make you good enough. That's why Christ came. He did what you could never do. So stop letting that feeling push you away. Let it push you in.`
  },
  {
    patterns: ['what does it mean to deny yourself', 'deny yourself', 'what is self denial', 'denying yourself', 'deny self'],
    answer: `It means denying everything you think makes you who you are. Your personality, your preferences, your habits, your reactions -- all of it gets challenged. Because the version of you that you've grown comfortable with is not the final version God is building. That's why it's hard. You're trying to let go of what feels like your real identity. You have to stop feeding your past and start training for your future. Forget what's behind you. That's not your reference point anymore. When you understand where you're headed, self can't lead you there. So you deny it.`
  },
  {
    patterns: ['start strong and fall off', 'why do i fall off', 'start strong then quit', 'cant stay consistent', 'why do i give up', 'fall off track'],
    answer: `Because starting is easy. Staying requires discipline. Most people don't count the cost of what it takes to finish. They get excited, but they're not built yet. Scripture already told you this -- many are called, few are chosen. The one who endures to the end is the one who wins. When you fall off, it's because you went back to yourself. Your old thinking, your old habits, your old desires start pulling again and you follow them. You're still trying to lead your life instead of letting God lead it. When God orders your steps, you don't fall off. When you take control back, you do. So the issue isn't your start. It's your submission.`
  },
  {
    patterns: ['am i really saved', 'how do i know if im saved', 'really saved or emotional', 'saved or just emotional', 'how do i know im truly saved'],
    answer: `You'll know by your fruit. Emotions don't disappear when you get saved, but they stop controlling you when you grow. Being saved is the beginning, not the finish. If you don't come into the knowledge of the truth, you stay stuck at the surface. The Word is what separates emotion from transformation. You can feel everything and still obey God. That's the difference. Jesus felt emotion, but He still said nevertheless. When you're really growing, your emotions lose their power to direct your decisions. They might speak, but they don't lead. That's how you know something real happened.`
  },
  {
    patterns: ['why does god feel silent', 'god is silent', 'why is god quiet', 'god not speaking', 'god feels silent', 'god stopped speaking'],
    answer: `Because sometimes He is. But silence does not mean absence. God will get quiet because He's testing what's already been built in you. When it's time for a test, the teacher stops talking. You already saw this -- Jesus was on the boat, asleep in the storm. His silence didn't mean He wasn't there. It meant they were supposed to respond with what they had already learned. God's silence is not punishment. It's confidence. He's watching to see if you'll use what He already gave you. So don't panic in silence. Go back to what you were taught and walk it out.`
  },
  {
    patterns: ['how do i know my calling', 'what is my calling', 'how to find my calling', 'what am i called to do', 'find my purpose', 'what is my purpose'],
    answer: `You don't discover your calling by chasing a role. You discover it by answering God. Most people are looking for a title, a position, or a gift. That's not your calling. Your first calling is to become like Christ. That's the foundation. Everything else comes after that. Yes, you may have gifts. Yes, you may walk in different functions. But if you don't understand who is calling you and what He's calling you to become, you'll misuse all of it. You're trying to figure it out before you've even answered. So stop worrying about what your calling is. Answer the call first. Then God will reveal the rest as you grow.`
  },
  {
    patterns: ['hurt by the church', 'church hurt me', 'been hurt by church', 'why go back to church', 'church hurt', 'church disappointed me'],
    answer: `Because your development doesn't happen in isolation. You got hurt by people, not by God. And you don't abandon purpose because people failed in their process. You get hurt in school, you still go back. You get hurt in life, you still keep living. So why is church the one place you quit? The church is full of people in development, just like you. That means there will be friction. That's not always damage. Sometimes that's growth. You don't even know who you are until you're around people who challenge you, frustrate you, and expose what's still in you. Running away doesn't heal you. It freezes you. So yes, go back. Grow up. Get stronger. And if needed, go to a different church -- but don't disconnect from the body.`
  },
  {
    patterns: ['born this way', 'i was born this way', 'feel like i was born this way', 'created this way', 'made this way'],
    answer: `It doesn't matter what you feel. It matters what God created. Your feelings are real, but they are not final. They don't define truth. God designed you with intention. Your body, your identity, your structure -- that wasn't random. When you try to override that, you're not discovering yourself. You're resisting your design. And the problem is people want to redefine themselves but still expect God to agree with it. That's not how this works. You have to choose. Either you align with what God created, or you follow what you feel. But your feelings don't rewrite truth.`
  },
  {
    patterns: ['sex before marriage', 'is it wrong to have sex before marriage', 'premarital sex', 'sex before marriage if we love each other', 'is sex before marriage a sin'],
    answer: `Yes. Love does not replace order. You're trying to take the benefits of covenant without the commitment of covenant. That's not how God designed it. Sex was never just physical. It connects souls. It transfers things. It binds people together deeper than they realize. So when you step into that outside of God's structure, you're opening yourself up without protection. Marriage is not just a ceremony. It's covering. It's alignment with how God set it up. You don't redefine the rules because you feel something strong. You either follow God's design, or you deal with the consequences of ignoring it.`
  },
  {
    patterns: ['god feels unfair', 'god is unfair', 'why does god seem unfair', 'life feels unfair with god', 'god is not fair', 'why isnt god fair'],
    answer: `Because you're expecting fairness from a God who operates in justice. God is not trying to make everything feel equal. He's working according to purpose. What looks unfair to you might be necessary for where you're going. Different people are given different levels of pressure, responsibility, and testing. That's not unfair. That's specific. You don't judge your life by what someone else is going through. You judge it by what God is producing in you. So instead of asking why it's not fair, ask what it's building. Because God doesn't waste pressure. He uses it.`
  },
  {
    patterns: ['why do i keep doubting', 'why do i doubt god', 'i believe but i still doubt', 'doubt even when i believe', 'cant stop doubting'],
    answer: `Because your confidence in doubt is stronger than your confidence in truth. Belief without knowledge is unstable. You don't have enough facts rooted in the Word, so your mind defaults back to what feels familiar. Doubt is comfortable. Faith is not. It's uncomfortable to believe what you can't see, what you haven't experienced, and what doesn't make sense yet. So when pressure comes, you fall back to what feels safe, not what is true. If you want to stop doubting, you need to build your belief on what God said, not what you see. Get the Word in you. Guard it. Act on it. That's how belief starts overpowering doubt.`
  },
  {
    patterns: ['cant stay consistent with god', 'why cant i stay consistent', 'inconsistent with god', 'keep being inconsistent', 'struggle to be consistent with god'],
    answer: `Because He's not your priority. You may like the idea of God, but your life shows what actually matters to you. You're consistent with what you value. That's just reality. If something is important to you, you make time for it. You stay disciplined with it. You don't negotiate with it. So if you're inconsistent with God, it's not a mystery. It's a priority problem. Scripture already made it plain -- if you love Him, you keep His commands. Consistency is not about effort. It's about value. And right now, you don't value Him enough to stay consistent.`
  },
  {
    patterns: ['keep failing over and over', 'i keep failing', 'why do i keep failing', 'failing over and over', 'cant stop failing'],
    answer: `You need to figure out if you're falling or failing. Falling is part of the process. Failing is lack of preparation. If you keep failing, it's because you're not training for what you're up against. This is not casual. You're dealing with real forces, real patterns, real habits that don't break just because you said a prayer. There are levels to this. And higher levels require preparation, discipline, and strategy. God doesn't pass you because you're tired of the lesson. He passes you when you master it. That's why people stay in the same cycle for years -- not because God won't move them forward, but because they haven't prepared to move forward. Stop asking why you keep failing. Start asking what you haven't mastered yet.`
  },
  {
    patterns: ['other people are ahead of me', 'why is everyone ahead of me', 'why am i behind', 'others are further along', 'why do others seem more successful'],
    answer: `Because they are. That's life. Somebody is always going to be ahead of you. But you're focused on the wrong thing. Your position doesn't matter as much as your posture. You're comparing progress when you should be focusing on alignment. Scripture already told you comparing yourself is unwise. So why are you doing it? You don't know what they had to go through to get where they are. And you don't know what they're dealing with right now. Stop watching them. Focus on what God is telling you to do. Get your posture right, and your position will take care of itself.`
  },
  {
    patterns: ['do i have to read the bible every day', 'do i need to read the bible daily', 'read the bible every day', 'bible every day', 'how often should i read the bible'],
    answer: `No, you don't have to read it every day. But you do have to live from it every day. Your spiritual life requires the same thing your natural body does -- daily intake. You eat every day. You drink every day. Because your body needs it. Your spirit is no different. If the Word is not in you, something else will take its place. If you've already built it in you, you can recall it, speak it, live from it. But if it's not in you, you have nothing to pull from. This is not about legalism. This is about survival. And the real issue is not discipline. It's love. Because if you loved Him, it wouldn't feel like a burden to stay in His Word.`
  },
  {
    patterns: ['why do i keep doubting even', 'keep doubting even when', 'doubt even though i believe'],
    answer: `Because your confidence in doubt is stronger than your confidence in truth. Belief without knowledge is unstable. You don't have enough facts rooted in the Word, so your mind defaults back to what feels familiar. Doubt is comfortable. Faith is not. It's uncomfortable to believe what you can't see, what you haven't experienced, and what doesn't make sense yet. So when pressure comes, you fall back to what feels safe, not what is true. If you want to stop doubting, you need to build your belief on what God said, not what you see. Get the Word in you. Guard it. Act on it. That's how belief starts overpowering doubt.`
  },
  {
    patterns: ['doing everything right but life not getting better', 'i do everything right', 'doing everything right and nothing', 'why isnt my life getting better', 'doing everything right why'],
    answer: `You're not doing everything right -- you're not even being humble. Nobody's done everything right except Jesus. So that mindset alone tells you something's off. You don't measure your life by your effort. You measure it by alignment.`
  },
  {
    patterns: ['why would god create me knowing i would struggle', 'why did god make me this way', 'god knew i would struggle', 'why create me to suffer', 'why did god make me knowing'],
    answer: `So you could experience victory. You don't get that without a fight. The struggle isn't the problem -- it's the setup.`
  },
  {
    patterns: ['tired of trying', 'what is the point of all this', 'whats the point of trying', 'tired of fighting', 'im tired of this'],
    answer: `The point is eternity. Heaven or hell. Where you spend forever -- that's the point.`
  },
  {
    patterns: ['why does god bless other people and not me', 'god blesses everyone but me', 'why does god bless others', 'god blesses other people'],
    answer: `God can bless whoever He wants. But you're wrong -- He's already blessed you. You being alive to ask that question is proof of it.`
  },
  {
    patterns: ['ive been faithful and nothing changed', 'been faithful but nothing changes', 'i have been faithful', 'faithful but no results'],
    answer: `If you can say you've been faithful, that is the change. You weren't always that.`
  },
  {
    patterns: ['maybe this isnt for me', 'maybe god isnt for me', 'this faith isnt for me', 'christianity isnt for me', 'maybe religion isnt for me'],
    answer: `It is for you -- you just don't want it. And if it's not God, then it's hell. There is no middle.`
  },
  {
    patterns: ['why does god seem to ignore me', 'god is ignoring me', 'feel like god ignores me', 'god ignoring my prayers'],
    answer: `It's not that He's ignoring you -- you're not approaching Him the right way. Repent, confess, believe. Then you'll be heard.`
  },
  {
    patterns: ['keep messing up what is the point', 'what is the point if i just fail again', 'why try if i keep failing', 'point of trying if i fail'],
    answer: `The point is the process. A just man falls and gets back up. If you're learning every time, you're not losing -- you're growing.`
  },
  {
    patterns: ['god helping everyone else but me', 'god helps everyone but me', 'why does god help others and not me', 'god blesses everyone else'],
    answer: `Because your feelings lie to you. You don't know who God is helping. And the fact you're alive asking that question means He's already helping you.`
  },
  {
    patterns: ['i prayed and it didnt happen', 'prayed for something and nothing happened', 'my prayer wasnt answered', 'prayed and god didnt answer', 'prayer didnt work'],
    answer: `The point is persistence. The point is patience. You don't quit because it didn't happen when you wanted it to.`
  },
  {
    patterns: ['if god loves me why do i feel alone', 'god loves me but i feel alone', 'why do i feel so alone if god', 'feel alone even with god'],
    answer: `Because feelings isolate you so you stop depending on God. But the truth is, you're not alone.`
  },
  {
    patterns: ['keep asking god for help but nothing changes', 'asking god for help and nothing happens', 'is god even listening to me', 'god not answering my prayers'],
    answer: `He's listening. You just don't control the timing. You don't rush God -- you trust Him.`
  },
  {
    patterns: ['people who dont follow god seem happier', 'non believers seem happier', 'why do sinners seem happy', 'ungodly people seem better off'],
    answer: `Because what you're seeing isn't the whole story. Happiness is surface. You're comparing appearances, not reality.`
  },
  {
    patterns: ['messed up too many times god doesnt want me', 'too many mistakes for god', 'god doesnt want me anymore', 'messed up too many times'],
    answer: `That's not true. God doesn't run out of chances. If you can repent, you can come back.`
  },
  {
    patterns: ['what if i dont actually believe', 'i dont think i really believe', 'what if i dont believe deep down', 'not sure i really believe'],
    answer: `Then you need to deal with that now. Because where that leads is not where you want to end up.`
  },
  {
    patterns: ['following god feels harder than living how i want', 'why is following god so hard', 'living for god is harder', 'why is christianity so hard'],
    answer: `Because discipline is always harder than doing whatever you want. But one leads somewhere -- one doesn't.`
  },
  {
    patterns: ['no difference between believers and non believers', 'christians act just like everyone else', 'cant tell christians from non christians', 'believers dont look different'],
    answer: `That's because you don't know what to look for. You can only recognize what you understand.`
  },
  {
    patterns: ['what if this is all wrong', 'what if christianity is wrong', 'what if i wasted my time', 'what if i have been wrong about god'],
    answer: `You didn't waste your time becoming better. You just don't see the value yet.`
  }
];

// ============================================================
// PATTERN MATCHER
// ============================================================
function checkHardCodedResponse(question) {
  const q = question.toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D"'?.,!]/g, '')
    .trim();
  for (const entry of VOICE_RESPONSES) {
    const matched = entry.patterns.find(p => q.includes(p));
    if (matched) {
      console.log('[GP73] Hard match:', matched);
      return entry.answer;
    }
  }
  return null;
}

// ============================================================
// DOCTRINE FILTER
// ============================================================
function enforceDoctrine(question = '', answer = '') {
  const q = question.toLowerCase();
  if (q.includes('gay') || q.includes('homosexual') || q.includes('same sex') || q.includes('can i be gay')) {
    return `No. You cannot live in a lifestyle that contradicts God's design and expect alignment with Him. God doesn't adjust His standards based on culture or feelings. Repentance means turning, not just feeling bad. You can't keep walking toward something God called sin and call it alignment with Him. You have to choose.`;
  }
  return answer;
}

// ============================================================
// PART 3 — VOICE ENFORCER with retry logic
// Rejects soft language and retries up to once
// ============================================================
// Only the hardest fails get rejected and retried
// Soft phrases are stripped inline rather than triggering a full retry
const HARD_BANNED_STARTS = [
  "i understand how you feel",
  "that's a great question",
  "that's a good question",
  "it's completely normal",
  "many people struggle with",
  "it is completely normal",
  "christianity isn't about control",
  "christianity is about guidance and freedom"
];

function voiceCheck(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Only hard-reject on the weakest possible openings
  for (const start of HARD_BANNED_STARTS) {
    if (lower.startsWith(start)) return null;
  }

  // Strip em dashes and clean up inline
  return text.trim().replace(/—/g, ',');
}

// ============================================================
// EMBEDDING + RAG via match_documents() RPC
// ============================================================
async function getEmbedding(question) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: question }),
  });
  const data = await r.json();
  return data.data?.[0]?.embedding;
}

// Query Supabase using match_documents() vector similarity RPC
// Returns top 3 tightest matches with keyword alignment check
async function queryTeachings(question) {
  try {
    const embedding = await getEmbedding(question);
    if (!embedding) return null;

    // Pull top 8 candidates — we'll filter down to top 3
    const rpcRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/match_documents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query_embedding: embedding, match_count: 8 }),
      }
    );

    if (!rpcRes.ok) {
      console.warn('[GP73 RAG] RPC error:', rpcRes.status);
      return null;
    }

    const docs = await rpcRes.json();
    if (!Array.isArray(docs) || !docs.length) return null;

    // STEP 1 — Similarity threshold filter
    const aboveThreshold = docs.filter(d => (d.similarity || 0) >= 0.35);
    if (!aboveThreshold.length) return null;

    // STEP 2 — Keyword alignment check
    // Extract meaningful terms from the question (skip stop words)
    const stopWords = new Set(['what','is','the','a','an','of','to','in','and','or','for','do','does','how','why','when','who','are','was','were','be','been','i','my','me','you','your','we','they','it','this','that','can','will','have','has','had','not','no','but']);
    const queryTerms = question.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    // Score each doc by keyword hits in its content
    const scored = aboveThreshold.map(d => {
      const text = (d.content || d.title || '').toLowerCase();
      const keywordHits = queryTerms.filter(term => text.includes(term)).length;
      return { ...d, keywordHits };
    });

    // STEP 3 — Discard chunks with zero keyword alignment if we have better options
    const aligned = scored.filter(d => d.keywordHits > 0);
    const pool = aligned.length >= 1 ? aligned : scored; // fallback if no keyword match

    // STEP 4 — Prefer chunks from the same teaching (highest similarity title)
    // Group by title, pick best per title, then sort by similarity
    const byTitle = {};
    for (const d of pool) {
      const key = (d.title || 'untitled').toLowerCase();
      if (!byTitle[key] || d.similarity > byTitle[key].similarity) {
        byTitle[key] = d;
      }
    }
    const deduplicated = Object.values(byTitle)
      .sort((a, b) => b.similarity - a.similarity);

    // STEP 5 — Take top 3 only
    const top3 = deduplicated.slice(0, 3);

    console.log('[GP73 RAG] Selected:', top3.map(d => ({
      id: d.id,
      title: d.title,
      sim: d.similarity?.toFixed(3),
      keywordHits: d.keywordHits
    })));

    // STEP 6 — Build context block
    // If top result is significantly better, use only that teaching
    const topSim = top3[0]?.similarity || 0;
    const secondSim = top3[1]?.similarity || 0;
    const useOnlyTop = (topSim - secondSim) > 0.12; // clear winner — don't mix teachings

    const selected = useOnlyTop ? top3.slice(0, 1) : top3;
    console.log('[GP73 RAG]', useOnlyTop ? 'Single teaching mode' : `Multi-teaching mode (${selected.length})`);

    const context = selected.map((d, i) => {
      const text = (d.content || '').replace(/\u0000/g, '').trim();
      return `[Teaching ${i + 1}: ${d.title || 'Untitled'}]\n${text.slice(0, 1400)}`;
    }).join('\n\n---\n\n');

    return context;

  } catch (err) {
    console.warn('[GP73 RAG] Query failed, falling through:', err.message);
    return null;
  }
}

function buildContext(docs = []) {
  if (!docs.length) return { context: '', hasRelevant: false };
  const relevant = docs.filter(d => (d.similarity || 0) >= 0.35);
  if (!relevant.length) return { context: '', hasRelevant: false };
  const context = relevant.slice(0, 3).map((d, i) => {
    const raw = d.Content || d.Summary || '';
    return `[Teaching ${i + 1}: ${d.Title || ''}]\n${raw.slice(0, 1200)}`;
  }).join('\n\n---\n\n');
  return { context, hasRelevant: true };
}

// ============================================================
// PART 4 — GPT CALL with posture-aware transformation
// ============================================================
async function callGPT(messages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 250,
      messages,
    }),
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================
// TONE CLASSIFIER
// Detects whether the user is SEEKING, STRUGGLING, or CORRECTING
// This drives HOW the response opens and flows -- not what it says
// ============================================================
function classifyTone(q) {
  const lower = q.toLowerCase();

  // STRUGGLING -- emotional, defeated, confused, personal pain
  const strugglingSignals = [
    'why is', 'why am i', 'why do i', 'why can\'t i', 'why don\'t i',
    'i feel', 'i\'m struggling', 'i keep', 'i can\'t', 'i don\'t understand',
    'help me', 'not working for me', 'lost', 'confused', 'broken',
    'depressed', 'hopeless', 'alone', 'tired', 'hurt', 'scared'
  ];

  // CORRECTION -- confident but potentially wrong assumptions, resistance, challenges
  const correctionSignals = [
    'i think', 'i believe', 'i don\'t think', 'i don\'t believe',
    'why would', 'why should', 'i don\'t need', 'that\'s not',
    'you\'re wrong', 'that doesn\'t make sense', 'i disagree',
    'hypocrites', 'just want money', 'too controlling', 'man-made',
    'old testament', 'doesn\'t work', 'never works'
  ];

  if (strugglingSignals.some(s => lower.includes(s))) return 'STRUGGLING';
  if (correctionSignals.some(s => lower.includes(s))) return 'CORRECTION';
  return 'SEEKING';
}

async function safeGenerate(question, systemPrompt, teachingContext, posture, conversationContext = null) {

  // Classify tone to drive HOW we respond -- not what content we use
  const toneClass = classifyTone(question);
  console.log('[GP73 TONE]', toneClass);

  // Build tone-specific instruction -- no hardcoded openers, no templates
  const toneInstruction = toneClass === 'SEEKING'
    ? `The person is genuinely curious. Open naturally -- no correction, no challenge. Draw them into the truth with clarity and confidence. Start with what the teaching says, not with what they got wrong. Vary how you begin each response.`
    : toneClass === 'STRUGGLING'
    ? `The person is hurting or confused. Do NOT open with correction or challenge. Begin with brief acknowledgment of where they are, then move them toward truth from the teachings. Be firm but not harsh. The tone is a steady hand, not a rebuke.`
    : `The person has a wrong assumption or is resisting truth. Address it directly but do not start with a canned phrase like "Here's the truth" or "You're looking at this wrong." Expose the flaw naturally within the first sentence. Vary the opening -- no repeated patterns.`;

  // Build grounded system prompt from teaching context when available
  const groundedSystem = teachingContext
    ? `You are a biblical teacher responding from the teaching content provided below.
You do NOT generate generic Christian answers.
You speak from these specific teachings with their language, depth, and perspective.
No em dashes. No filler phrases. No templated openers.
Response length matches the question -- concise for simple questions, fuller for deep ones. Do not over-explain.

${toneInstruction}

GLOBAL RULES:
- Never start two responses the same way
- Do not wrap openers in quotation marks
- Do not use: "Here's the truth whether you like it or not", "You're looking at this from the wrong direction", "The issue isn't what you think it is"
- Sound like a real person teaching, not a scripted bot

TEACHING CONTEXT:
${teachingContext}`
    : `${systemPrompt}

${toneInstruction}

GLOBAL RULES:
- Never start two responses the same way
- Do not wrap openers in quotation marks
- Do not use: "Here's the truth whether you like it or not", "You're looking at this from the wrong direction"
- Sound like a real person teaching, not a scripted bot`;

  const conversationNote = conversationContext
    ? `RECENT CONVERSATION (for continuity only -- do NOT let this override the current question):
${conversationContext}

`
    : '';

  const userPrompt = `${conversationNote}Current question: "${question}"

Respond directly and naturally. Use the teaching context. Do not guess or generalize beyond what is provided. If the current question follows from a prior turn, acknowledge that naturally but keep focus on what they're asking now.`;

  const messages = [
    { role: 'system', content: groundedSystem },
    { role: 'user', content: userPrompt },
  ];

  // Retry once if voice check hard-fails
  for (let i = 0; i < 2; i++) {
    const raw = await callGPT(messages);
    console.log('[GP73 RAW]', raw);
    const clean = voiceCheck(raw);
    if (clean) return clean;
    console.log('[GP73] Voice check fail, retrying...');
  }

  // Return raw on second fail -- better than a canned line
  const raw = await callGPT(messages);
  return raw.trim() || 'Check the Word on this one.';
}

// ============================================================
// SHORT-TERM MEMORY
// Stores last 2 turns per session to maintain conversational continuity.
// Uses sessionId from request body (frontend must send it).
// Falls back to a global slot if no sessionId provided.
// Memory is in-process only -- resets on cold start. Intentional.
// ============================================================
const sessionMemory = new Map();

function getMemory(sessionId) {
  return sessionMemory.get(sessionId) || [];
}

function updateMemory(sessionId, question, answer) {
  const history = getMemory(sessionId);
  history.push({ question, answer });
  if (history.length > 2) history.shift();
  sessionMemory.set(sessionId, history);
  if (sessionMemory.size > 500) {
    const firstKey = sessionMemory.keys().next().value;
    sessionMemory.delete(firstKey);
  }
}

function buildConversationContext(history) {
  if (!history.length) return null;
  return history.map((turn, i) =>
    `[Prior turn ${i + 1}]\nThey asked: ${turn.question}\nYou said: ${turn.answer.slice(0, 180)}`
  ).join('\n\n');
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { question = '', sessionId = 'default' } = req.body || {};
    if (!question.trim()) {
      return res.status(400).json({ error: 'Missing question' });
    }

    // Load short-term memory for this session
    const priorHistory = getMemory(sessionId);
    const conversationContext = buildConversationContext(priorHistory);

    // STEP 1 — Check hard-coded voice responses first
    const hardCoded = checkHardCodedResponse(question);
    if (hardCoded) {
      console.log('[GP73] Hard-coded match');
      const answer = voiceCheck(enforceDoctrine(question, hardCoded)) || hardCoded;
      return res.status(200).json({ source: 'gp73-brain', answer });
    }

    // STEP 2 — Doctrine filter (gay/same sex handled before GPT)
    const doctrineAnswer = enforceDoctrine(question, '');
    if (doctrineAnswer) {
      return res.status(200).json({ source: 'gp73-brain', answer: doctrineAnswer });
    }

    // STEP 3 — Detect intent and posture
    const intent = detectIntent(question);
    const posture = detectPosture(question);
    console.log('[GP73]', { intent, posture });

    // STEP 4 — Retrieve grounded teachings via match_documents() RPC
    // Only runs on spiritual questions. Hard-coded answers already returned above.
    let teachingContext = null;

    if (intent === 'spiritual') {
      teachingContext = await queryTeachings(question);
      if (teachingContext) {
        console.log('[GP73] Teaching context retrieved, grounding response');
      } else {
        console.log('[GP73] No teaching match -- voice-only fallback');
      }
    }

    // STEP 5 — Generate response grounded in teachings
    // teachingContext replaces generic VOICE_SYSTEM_PROMPT when available
    // conversationContext adds last 1-2 turns for continuity -- does NOT override current question
    const systemPrompt = intent === 'general' ? GENERAL_PROMPT : VOICE_SYSTEM_PROMPT;
    const answer = await safeGenerate(question, systemPrompt, teachingContext, posture, conversationContext);

    // Save this turn to memory
    updateMemory(sessionId, question, answer);

    console.log('[GP73 FINAL]', answer);
    return res.status(200).json({ source: 'gp73-brain', answer });

  } catch (error) {
    console.error('[GP73 ERROR]', error.message);
    return res.status(500).json({
      error: error.message,
      answer: 'System error -- try again.',
    });
  }
}
