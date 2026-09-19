/* Framework Deck - offline-first flashcards for recurring problems.
   All data lives in this browser's localStorage. Nothing leaves the device. */

const KEY = 'frameworkDeck.v1';
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- storage ---------- */
let state = { version: 1, decks: [] };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.decks)) state = normalize(parsed);
    }
  } catch (e) {
    console.warn('could not read saved decks', e);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    toast('Could not save - storage is full or blocked');
  }
}

function normalize(data) {
  return {
    version: 1,
    decks: (data.decks || []).map((d) => ({
      id: d.id || uid(),
      name: String(d.name || 'Untitled deck'),
      note: String(d.note || ''),
      createdAt: d.createdAt || Date.now(),
      cards: (d.cards || []).map((c) => ({
        id: c.id || uid(),
        front: String(c.front || ''),
        back: String(c.back || ''),
        createdAt: c.createdAt || Date.now()
      }))
    }))
  };
}

const deckById = (id) => state.decks.find((d) => d.id === id);

/* ---------- navigation ---------- */
let view = { screen: 'decks', deckId: null };

function go(screen, deckId, push = true) {
  view = { screen, deckId: deckId || null };
  if (push) history.pushState({ ...view }, '');
  render();
}

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.screen) {
    view = { screen: e.state.screen, deckId: e.state.deckId };
  } else {
    view = { screen: 'decks', deckId: null };
  }
  render();
});

/* ---------- render ---------- */
function render() {
  const deck = deckById(view.deckId);
  if (view.screen !== 'decks' && !deck) view = { screen: 'decks', deckId: null };

  $('view-decks').hidden = view.screen !== 'decks';
  $('view-deck').hidden = view.screen !== 'deck';
  $('view-study').hidden = view.screen !== 'study';
  $('backBtn').hidden = view.screen === 'decks';

  if (view.screen === 'decks') { $('title').textContent = 'Decks'; renderDecks(); }
  if (view.screen === 'deck') { $('title').textContent = deck.name; renderDeck(deck); }
  if (view.screen === 'study') { $('title').textContent = deck.name; renderStudy(); }
}

function renderDecks() {
  const list = $('deckList');
  list.innerHTML = '';
  $('decksEmpty').hidden = state.decks.length > 0;
  for (const deck of state.decks) {
    const li = document.createElement('li');
    li.className = 'deck-item';
    const n = deck.cards.length;
    li.innerHTML =
      '<div class="grow"><div class="name"></div><div class="sub"></div></div><span class="chev">&#8250;</span>';
    li.querySelector('.name').textContent = deck.name;
    li.querySelector('.sub').textContent =
      (n === 1 ? '1 card' : n + ' cards') + (deck.note ? ' · ' + deck.note : '');
    li.onclick = () => go('deck', deck.id);
    list.appendChild(li);
  }
}

function renderDeck(deck) {
  $('deckNote').textContent = deck.note;
  $('cardCount').textContent = deck.cards.length ? '(' + deck.cards.length + ')' : '';
  const empty = deck.cards.length === 0;
  $('cardsEmpty').hidden = !empty;
  $('studyBtn').disabled = empty;
  $('studyRandomBtn').disabled = empty;

  const list = $('cardList');
  list.innerHTML = '';
  deck.cards.forEach((card, i) => {
    const li = document.createElement('li');
    li.className = 'card-item';
    li.innerHTML = '<div class="grow"><div class="front"></div><div class="sub"></div></div>';
    li.querySelector('.front').textContent = card.front || '(no front)';
    li.querySelector('.sub').textContent = card.back.replace(/\s+/g, ' ');
    li.onclick = () => openCardForm(deck, i);
    list.appendChild(li);
  });
}

/* ---------- study ---------- */
let study = { deckId: null, mode: 'order', order: [], pos: 0 };

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startStudy(deck, mode, startIndex) {
  study.deckId = deck.id;
  study.mode = mode;
  study.order = mode === 'random' ? shuffled(deck.cards.length) : Array.from({ length: deck.cards.length }, (_, i) => i);
  study.pos = 0;
  if (typeof startIndex === 'number') {
    const at = study.order.indexOf(startIndex);
    study.pos = at < 0 ? 0 : at;
  }
  go('study', deck.id);
}

function renderStudy() {
  const deck = deckById(study.deckId);
  if (!deck || !deck.cards.length) return go('deck', view.deckId, false);
  if (study.order.length !== deck.cards.length) startStudyKeepMode(deck);

  const card = deck.cards[study.order[study.pos]];
  $('cardFront').textContent = card.front || '(no front)';
  $('cardBack').textContent = card.back || '(nothing on the back yet)';
  $('studyProgress').textContent = study.pos + 1 + ' / ' + deck.cards.length;
  $('modeOrder').classList.toggle('is-on', study.mode === 'order');
  $('modeRandom').classList.toggle('is-on', study.mode === 'random');
  unflip();
}

function startStudyKeepMode(deck) {
  study.order = study.mode === 'random' ? shuffled(deck.cards.length) : Array.from({ length: deck.cards.length }, (_, i) => i);
  study.pos = Math.min(study.pos, Math.max(0, deck.cards.length - 1));
}

function unflip() {
  const flip = $('flip');
  flip.classList.add('no-anim');
  flip.classList.remove('is-flipped');
  requestAnimationFrame(() => requestAnimationFrame(() => flip.classList.remove('no-anim')));
}

function step(delta) {
  const deck = deckById(study.deckId);
  if (!deck || !deck.cards.length) return;
  const n = deck.cards.length;
  const next = study.pos + delta;
  if (next >= n) {
    // finished a pass: reshuffle in random mode, loop back in order mode
    if (study.mode === 'random') study.order = shuffled(n);
    study.pos = 0;
    if (n > 1) toast(study.mode === 'random' ? 'Reshuffled' : 'Back to the first card');
  } else if (next < 0) {
    study.pos = n - 1;
  } else {
    study.pos = next;
  }
  renderStudy();
}

function jumpRandom() {
  const deck = deckById(study.deckId);
  if (!deck || deck.cards.length < 2) return renderStudy();
  const current = study.order[study.pos];
  let pick = current;
  while (pick === current) pick = Math.floor(Math.random() * deck.cards.length);
  const at = study.order.indexOf(pick);
  study.pos = at < 0 ? 0 : at;
  renderStudy();
}

function setMode(mode) {
  const deck = deckById(study.deckId);
  if (!deck) return;
  const current = study.order[study.pos];
  study.mode = mode;
  startStudyKeepMode(deck);
  const at = study.order.indexOf(current);
  study.pos = at < 0 ? 0 : at;
  renderStudy();
}

/* ---------- sheets ---------- */
function openSheet(which) {
  $('sheetWrap').hidden = false;
  for (const el of ['deckForm', 'cardForm', 'menuSheet']) $(el).hidden = el !== which;
}
function closeSheet() {
  $('sheetWrap').hidden = true;
  for (const el of ['deckForm', 'cardForm', 'menuSheet']) $(el).hidden = true;
}
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('sheetWrap').hidden) closeSheet();
});

let editing = { deckId: null, cardIndex: null };

function openDeckForm(deck) {
  editing = { deckId: deck ? deck.id : null, cardIndex: null };
  $('deckFormTitle').textContent = deck ? 'Edit deck' : 'New deck';
  $('deckName').value = deck ? deck.name : '';
  $('deckNoteInput').value = deck ? deck.note : '';
  $('deleteDeckBtn').hidden = !deck;
  openSheet('deckForm');
  setTimeout(() => $('deckName').focus(), 60);
}

$('deckForm').onsubmit = (e) => {
  e.preventDefault();
  const name = $('deckName').value.trim();
  if (!name) return;
  const note = $('deckNoteInput').value.trim();
  const deck = deckById(editing.deckId);
  if (deck) {
    deck.name = name;
    deck.note = note;
  } else {
    const fresh = { id: uid(), name, note, createdAt: Date.now(), cards: [] };
    state.decks.push(fresh);
    view = { screen: 'deck', deckId: fresh.id };
    history.pushState({ ...view }, '');
  }
  save();
  closeSheet();
  render();
};

$('deleteDeckBtn').onclick = () => {
  const deck = deckById(editing.deckId);
  if (!deck) return;
  if (!confirm('Delete "' + deck.name + '" and its ' + deck.cards.length + ' card(s)?')) return;
  state.decks = state.decks.filter((d) => d.id !== deck.id);
  save();
  closeSheet();
  view = { screen: 'decks', deckId: null };
  render();
  toast('Deck deleted');
};

function openCardForm(deck, cardIndex) {
  editing = { deckId: deck.id, cardIndex: typeof cardIndex === 'number' ? cardIndex : null };
  const card = editing.cardIndex !== null ? deck.cards[editing.cardIndex] : null;
  $('cardFormTitle').textContent = card ? 'Edit card' : 'New card';
  $('cardFrontInput').value = card ? card.front : '';
  $('cardBackInput').value = card ? card.back : '';
  $('deleteCardBtn').hidden = !card;
  openSheet('cardForm');
  setTimeout(() => $('cardFrontInput').focus(), 60);
}

$('cardForm').onsubmit = (e) => {
  e.preventDefault();
  const deck = deckById(editing.deckId);
  if (!deck) return closeSheet();
  const front = $('cardFrontInput').value.trim();
  const back = $('cardBackInput').value.trim();
  if (!front) return;
  if (editing.cardIndex !== null) {
    Object.assign(deck.cards[editing.cardIndex], { front, back });
  } else {
    deck.cards.push({ id: uid(), front, back, createdAt: Date.now() });
  }
  save();
  closeSheet();
  render();
};

$('deleteCardBtn').onclick = () => {
  const deck = deckById(editing.deckId);
  if (!deck || editing.cardIndex === null) return;
  if (!confirm('Delete this card?')) return;
  deck.cards.splice(editing.cardIndex, 1);
  save();
  closeSheet();
  if (view.screen === 'study' && !deck.cards.length) view = { screen: 'deck', deckId: deck.id };
  render();
  toast('Card deleted');
};

/* ---------- menu: export / import / seed / wipe ---------- */
$('menuBtn').onclick = () => {
  const cards = state.decks.reduce((n, d) => n + d.cards.length, 0);
  $('storageNote').textContent =
    state.decks.length + ' deck(s), ' + cards + ' card(s), stored on this device only. Export now and then so a cleared browser does not take them with it.';
  openSheet('menuSheet');
};

const native = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? window.Capacitor.Plugins : null;

function downloadInBrowser(name, json) {
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* In the Android app a blob download does nothing, so write a real file and
   hand it to the system share sheet instead. */
async function exportDecks() {
  const json = JSON.stringify(state, null, 2);
  const name = 'framework-decks-' + new Date().toISOString().slice(0, 10) + '.json';
  const plugins = native();
  if (plugins && plugins.Filesystem && plugins.Share) {
    try {
      const file = await plugins.Filesystem.writeFile({
        path: name, data: json, directory: 'CACHE', encoding: 'utf8'
      });
      await plugins.Share.share({
        title: 'Framework decks backup',
        text: 'Backup of your decks',
        url: file.uri,
        dialogTitle: 'Save your decks'
      });
      return;
    } catch (e) {
      if (String(e && e.message).toLowerCase().includes('cancel')) return;
      toast('Share failed, trying a plain download');
    }
  }
  downloadInBrowser(name, json);
}

$('exportBtn').onclick = () => {
  exportDecks();
  closeSheet();
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = normalize(JSON.parse(await file.text()));
    const names = new Set(state.decks.map((d) => d.name));
    let added = 0;
    for (const deck of data.decks) {
      deck.id = uid();
      if (names.has(deck.name)) deck.name += ' (imported)';
      state.decks.push(deck);
      added++;
    }
    save();
    closeSheet();
    view = { screen: 'decks', deckId: null };
    render();
    toast('Imported ' + added + ' deck(s)');
  } catch (err) {
    toast('That file did not parse');
  }
  e.target.value = '';
};

$('seedBtn').onclick = () => {
  for (const deck of starterDecks()) state.decks.push(deck);
  save();
  closeSheet();
  view = { screen: 'decks', deckId: null };
  render();
  toast('Starter decks added');
};

$('wipeBtn').onclick = () => {
  if (!confirm('Erase every deck and card on this device? This cannot be undone.')) return;
  state = { version: 1, decks: [] };
  save();
  closeSheet();
  view = { screen: 'decks', deckId: null };
  render();
};

/* ---------- wiring ---------- */
$('backBtn').onclick = () => history.back();
$('addDeckBtn').onclick = () => openDeckForm(null);
$('editDeckBtn').onclick = () => openDeckForm(deckById(view.deckId));
$('addCardBtn').onclick = () => openCardForm(deckById(view.deckId));
$('studyBtn').onclick = () => startStudy(deckById(view.deckId), 'order');
$('studyRandomBtn').onclick = () => startStudy(deckById(view.deckId), 'random');
$('nextBtn').onclick = () => step(1);
$('prevBtn').onclick = () => step(-1);
$('shuffleBtn').onclick = jumpRandom;
$('modeOrder').onclick = () => setMode('order');
$('modeRandom').onclick = () => setMode('random');
$('editThisCardBtn').onclick = () => {
  const deck = deckById(study.deckId);
  if (deck) openCardForm(deck, study.order[study.pos]);
};

$('flip').onclick = () => $('flip').classList.toggle('is-flipped');
$('flip').onkeydown = (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    $('flip').classList.toggle('is-flipped');
  }
};

document.addEventListener('keydown', (e) => {
  if (view.screen !== 'study' || !$('sheetWrap').hidden) return;
  if (/input|textarea/i.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key.toLowerCase() === 'r') jumpRandom();
});

/* swipe on the card */
let touch = null;
$('flip').addEventListener('touchstart', (e) => {
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
$('flip').addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
}, { passive: true });

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1900);
}

/* ---------- starter content ---------- */
function starterDecks() {
  const mk = (name, note, cards) => ({
    id: uid(), name, note, createdAt: Date.now(),
    cards: cards.map(([front, back]) => ({ id: uid(), front, back, createdAt: Date.now() }))
  });
  return [
    mk("Can't start a task", 'For when the task is clear and I still do not move.', [
      ['Two-minute version', 'Shrink the task until it takes two minutes. Do only that. Stopping right after is allowed, and usually I do not.'],
      ['Name the dread', 'Write one sentence: what exactly am I avoiding? Boredom, looking stupid, an unclear first step, a decision I do not want to make. The named version is smaller than the vague one.'],
      ['Worst possible first draft', 'Produce the bad version on purpose. Ugly, wrong, unformatted. Editing something is a different job than starting something.'],
      ['Find the actual first physical action', 'Not "write the report". Open the doc, type the title, paste the three numbers. If the step is not something a body can do, it is still a plan, not a step.'],
      ['Five-minute timer, permission to quit', 'Set five minutes. When it rings I may stop with no guilt. The point is to break the standstill, not to finish.'],
      ['Change the venue', 'Move seats, room, or device. Starting is partly an environment cue, and a stale one keeps replaying the stall.'],
      ['Ask what would make this 10x easier', 'Delegate, delete, halve the scope, use last quarter\'s version as a template. A task I cannot start is sometimes a task too big for what it is worth.']
    ]),
    mk('How to influence my manager', 'Getting a yes without burning credibility.', [
      ['Lead with their problem', 'Open with the thing they are measured on, not the thing I want. My proposal is the vehicle; their metric is the reason.'],
      ['One page, three options', 'Recommended option, cheap option, do-nothing option, with the cost of each. Managers approve decisions faster than they approve ideas.'],
      ['Pre-wire before the meeting', 'Get objections in private first. A meeting is a bad place to hear "no" for the first time, and a good place to confirm a yes.'],
      ['Make the ask specific and small', 'Name exactly what I need: a decision, a headcount, two weeks, one intro. Vague asks get vague answers.'],
      ['Bring the risk yourself', 'State the strongest objection before they do, with how I would handle it. Volunteering the downside buys more trust than hiding it.'],
      ['Show a cheap proof', 'A prototype, a pilot on one team, a two-week test with a kill criterion. Reversible beats persuasive.'],
      ['Match their format', 'Notice how they decide: data, a story, a peer\'s opinion, a written memo read beforehand. Same content, their channel.'],
      ['Make it easy to say yes out loud', 'Draft the sentence they would say to their own boss. If I cannot write it in one line, my ask is not ready.']
    ]),
    mk('Stuck in a decision', 'When I keep circling the same choice.', [
      ['Reversible or not?', 'If it is cheap to undo, decide in minutes and move. Slow, careful deliberation is for the doors that lock behind me.'],
      ['Set a decision deadline', 'Pick the date and time I will decide with whatever I know then. Open-ended thinking expands to fill the calendar.'],
      ['What would I need to believe?', 'For each option, write the assumption that has to be true. Then go check the cheapest one to check.'],
      ['Regret in ten minutes, ten months, ten years', 'Three horizons, one line each. Most agonising choices look obvious at one of the three.'],
      ['Name the real constraint', 'Money, time, energy, a person, my own ego. Deciding without naming the binding constraint is guessing with extra steps.']
    ])
  ];
}

/* ---------- boot ---------- */
load();
if (!state.decks.length) {
  state.decks = starterDecks();
  save();
}
history.replaceState({ ...view }, '');
render();

if ('serviceWorker' in navigator && !native()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
