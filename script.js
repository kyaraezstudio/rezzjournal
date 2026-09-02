/* ========== UTIL ========== */
const $ = id => document.getElementById(id);
const leaf = $('leaf');
document.addEventListener('mousemove', e => {
  leaf.style.display = 'block';
  leaf.style.left = (e.clientX + 12) + 'px';
  leaf.style.top = (e.clientY + 12) + 'px';
});

function go(id){
  $(id).scrollIntoView({behavior:'smooth'});
}

function lsGet(key, fallback){
  try{
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  }catch(e){ return fallback; }
}
function lsSet(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ========== POINTS ========== */
let points = Number(localStorage.getItem('rz-points') || 0);
$('points').textContent = points;
function addPoint(n=5){
  points += n;
  localStorage.setItem('rz-points', points);
  $('points').textContent = points;
}

/* ========== BACKGROUND MUSIC (Web Audio) ========== */
let audioCtx = null;
let masterGain = null;
let musicPlaying = false;
let musicNodes = [];
let musicVol = 0.35;

function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = musicVol;
  masterGain.connect(audioCtx.destination);
}

function setMusicVolume(val){
  musicVol = Number(val) / 100;
  if(masterGain) masterGain.gain.setTargetAtTime(musicVol, audioCtx.currentTime, 0.05);
  const label = $('volLabel');
  if(label) label.textContent = val + '%';
  localStorage.setItem('rz-music-vol', val);
}

function playSoftNote(freq, startTime, duration, type='sine'){
  if(!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.12, startTime + 0.4);
  gain.gain.linearRampToValueAtTime(0.08, startTime + duration * 0.6);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  musicNodes.push(osc);
}

function startAmbientLoop(){
  ensureAudio();
  if(audioCtx.state === 'suspended') audioCtx.resume();

  const melody = [
    261.63, 329.63, 392.00, 440.00, 523.25,
    392.00, 329.63, 261.63, 293.66, 349.23
  ];
  const bass = [130.81, 146.83, 164.81, 174.61];

  let step = 0;
  const beat = 1.8;

  function schedule(){
    if(!musicPlaying) return;
    const t = audioCtx.currentTime;

    const root = bass[step % bass.length];
    playSoftNote(root, t, beat * 2.2, 'sine');
    playSoftNote(root * 1.5, t, beat * 2.0, 'triangle');
    playSoftNote(root * 2, t + 0.15, beat * 1.8, 'sine');

    const mel = melody[step % melody.length];
    playSoftNote(mel, t + 0.3, beat * 1.5, 'sine');
    if(step % 3 === 0){
      playSoftNote(mel * 1.5, t + 0.5, beat * 1.2, 'triangle');
    }

    step++;
    const id = setTimeout(schedule, beat * 1000);
    musicNodes.push({ stop: () => clearTimeout(id) });
  }

  schedule();
}

function stopMusic(){
  musicPlaying = false;
  musicNodes.forEach(n => {
    try{
      if(n.stop) n.stop();
      else if(typeof n === 'object' && n.disconnect) n.disconnect();
    }catch(e){}
  });
  musicNodes = [];
}

function toggleMusic(){
  const btn = $('btnMusic');
  const icon = $('musicIcon');
  const label = $('musicLabel');

  if(musicPlaying){
    stopMusic();
    btn.classList.remove('playing');
    icon.textContent = '🎵';
    label.textContent = 'Musik OFF';
    localStorage.setItem('rz-music-on', '0');
  } else {
    musicPlaying = true;
    startAmbientLoop();
    btn.classList.add('playing');
    icon.textContent = '🎶';
    label.textContent = 'Musik ON';
    localStorage.setItem('rz-music-on', '1');
  }
}

(function initMusicPrefs(){
  const savedVol = localStorage.getItem('rz-music-vol');
  if(savedVol !== null){
    const volEl = $('musicVolume');
    if(volEl){
      volEl.value = savedVol;
      setMusicVolume(savedVol);
    }
  }
})();

/* ========== TOOL SWITCHER ========== */
function openTool(name){
  document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
  const el = $('tool-' + name);
  if(el){
    el.classList.add('active');
    el.scrollIntoView({behavior:'smooth', block:'start'});
  }
  if(name === 'goals') renderGoals();
  if(name === 'habits') renderHabits();
  if(name === 'mood') renderMoodHistory();
  if(name === 'gratitude') renderGratitude();
  if(name === 'reflection') renderReflection();
  if(name === 'memories') renderMemories();
  if(name === 'quotes') renderQuotes();
  if(name === 'calendar') selectDay(current);
}

/* ========== CALENDAR ========== */
const cal = $('cal');
let current = 2;
const today = new Date();
if(today.getFullYear() === 2026 && today.getMonth() === 8){
  current = today.getDate();
}

['M','T','W','T','F','S','S'].forEach(x=>{
  const e = document.createElement('div');
  e.className = 'calhead';
  e.textContent = x;
  cal.appendChild(e);
});

const first = (new Date(2026,8,1).getDay() + 6) % 7;
for(let i=0;i<first;i++) cal.appendChild(document.createElement('div'));

for(let d=1; d<=30; d++){
  const b = document.createElement('button');
  b.className = 'calday' + (d === current ? ' marked' : '');
  b.textContent = d;
  if(localStorage.getItem('rz-'+d)) b.classList.add('has-entry');
  b.onclick = () => selectDay(d, b);
  cal.appendChild(b);
}

function selectDay(d, btn){
  current = d;
  $('dateTitle').textContent = 'September ' + d;
  $('entry').value = localStorage.getItem('rz-'+d) || '';
  document.querySelectorAll('.calday').forEach(x => x.classList.remove('marked'));
  if(btn) btn.classList.add('marked');
  else {
    document.querySelectorAll('.calday').forEach(x=>{
      if(Number(x.textContent) === d) x.classList.add('marked');
    });
  }
}

function saveEntry(){
  const val = $('entry').value.trim();
  if(val){
    localStorage.setItem('rz-'+current, val);
    document.querySelectorAll('.calday').forEach(x=>{
      if(Number(x.textContent) === current) x.classList.add('has-entry');
    });
    alert('Entry saved 🌿');
  } else {
    localStorage.removeItem('rz-'+current);
    alert('Entry kosong, dihapus.');
  }
}

function clearEntry(){
  $('entry').value = '';
}

/* ========== GOALS ========== */
function addGoal(){
  const input = $('goalInput');
  const text = input.value.trim();
  if(!text) return;
  const goals = lsGet('rz-goals', []);
  goals.unshift({id:Date.now(), text, done:false});
  lsSet('rz-goals', goals);
  input.value = '';
  renderGoals();
  addPoint(2);
}

function renderGoals(){
  const list = $('goalList');
  const goals = lsGet('rz-goals', []);
  if(!goals.length){
    list.innerHTML = '<p style="color:#8a7665">Belum ada goal. Tambah yang kecil aja 🌱</p>';
    return;
  }
  list.innerHTML = goals.map(g => `
    <div class="item">
      <div class="left">
        <input type="checkbox" ${g.done?'checked':''} onchange="toggleGoal(${g.id})">
        <span style="${g.done?'text-decoration:line-through;opacity:.6':''}">${escapeHtml(g.text)}</span>
      </div>
      <button class="secondary" style="padding:6px 10px" onclick="deleteGoal(${g.id})">✕</button>
    </div>
  `).join('');
}

function toggleGoal(id){
  const goals = lsGet('rz-goals', []);
  const g = goals.find(x=>x.id===id);
  if(g){
    g.done = !g.done;
    if(g.done) addPoint(5);
    lsSet('rz-goals', goals);
    renderGoals();
  }
}

function deleteGoal(id){
  let goals = lsGet('rz-goals', []);
  goals = goals.filter(x=>x.id!==id);
  lsSet('rz-goals', goals);
  renderGoals();
}

/* ========== HABITS ========== */
function addHabit(){
  const input = $('habitInput');
  const text = input.value.trim();
  if(!text) return;
  const habits = lsGet('rz-habits', []);
  habits.unshift({id:Date.now(), text, doneToday:false});
  lsSet('rz-habits', habits);
  input.value = '';
  renderHabits();
}

function renderHabits(){
  const list = $('habitList');
  const habits = lsGet('rz-habits', []);
  if(!habits.length){
    list.innerHTML = '<p style="color:#8a7665">Belum ada habit. Mulai dari yang kecil 🌱</p>';
    return;
  }
  list.innerHTML = habits.map(h => `
    <div class="item">
      <div class="left">
        <input type="checkbox" ${h.doneToday?'checked':''} onchange="toggleHabit(${h.id})">
        <span>${escapeHtml(h.text)}</span>
      </div>
      <button class="secondary" style="padding:6px 10px" onclick="deleteHabit(${h.id})">✕</button>
    </div>
  `).join('');
}

function toggleHabit(id){
  const habits = lsGet('rz-habits', []);
  const h = habits.find(x=>x.id===id);
  if(h){
    h.doneToday = !h.doneToday;
    if(h.doneToday) addPoint(3);
    lsSet('rz-habits', habits);
    renderHabits();
  }
}

function deleteHabit(id){
  let habits = lsGet('rz-habits', []);
  habits = habits.filter(x=>x.id!==id);
  lsSet('rz-habits', habits);
  renderHabits();
}

/* ========== MOOD ========== */
let selectedMood = null;
document.querySelectorAll('.mood-btn').forEach(btn=>{
  btn.onclick = () => {
    document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    selectedMood = btn.dataset.mood;
  };
});

function saveMood(){
  if(!selectedMood){
    alert('Pilih mood dulu 🌙');
    return;
  }
  const note = $('moodNote').value.trim();
  const history = lsGet('rz-moods', []);
  history.unshift({
    id: Date.now(),
    mood: selectedMood,
    note,
    date: new Date().toLocaleDateString('id-ID', {day:'numeric',month:'short'})
  });
  lsSet('rz-moods', history.slice(0,20));
  $('moodNote').value = '';
  selectedMood = null;
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));
  renderMoodHistory();
  addPoint(3);
  alert('Mood saved 🌙');
}

function renderMoodHistory(){
  const list = $('moodHistory');
  const history = lsGet('rz-moods', []);
  if(!history.length){
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '<h3 style="margin:0 0 8px">Riwayat</h3>' + history.map(m => `
    <div class="item">
      <div class="left">
        <span style="font-size:24px">${m.mood}</span>
        <div>
          <div style="font-size:13px;color:#8a7665">${m.date}</div>
          <div>${escapeHtml(m.note || '—')}</div>
        </div>
      </div>
    </div>
  `).join('');
}

/* ========== GRATITUDE ========== */
function saveGratitude(){
  const items = [$('grat1').value.trim(), $('grat2').value.trim(), $('grat3').value.trim()].filter(Boolean);
  if(!items.length){
    alert('Isi minimal 1 hal dulu 🤎');
    return;
  }
  const history = lsGet('rz-grat', []);
  history.unshift({
    id: Date.now(),
    items,
    date: new Date().toLocaleDateString('id-ID', {day:'numeric',month:'short'})
  });
  lsSet('rz-grat', history.slice(0,15));
  $('grat1').value = $('grat2').value = $('grat3').value = '';
  renderGratitude();
  addPoint(4);
  alert('Gratitude saved 🤎');
}

function renderGratitude(){
  const list = $('gratHistory');
  const history = lsGet('rz-grat', []);
  if(!history.length){ list.innerHTML=''; return; }
  list.innerHTML = '<h3 style="margin:0 0 8px">Riwayat</h3>' + history.map(g => `
    <div class="item" style="flex-direction:column;align-items:flex-start">
      <div style="font-size:13px;color:#8a7665;margin-bottom:6px">${g.date}</div>
      <div>${g.items.map(i=>`• ${escapeHtml(i)}`).join('<br>')}</div>
    </div>
  `).join('');
}

/* ========== REFLECTION ========== */
function saveReflection(){
  const text = $('reflectText').value.trim();
  if(!text) return;
  const history = lsGet('rz-reflect', []);
  history.unshift({
    id: Date.now(),
    text,
    date: new Date().toLocaleDateString('id-ID', {day:'numeric',month:'short'})
  });
  lsSet('rz-reflect', history.slice(0,15));
  $('reflectText').value = '';
  renderReflection();
  addPoint(4);
  alert('Reflection saved ✨');
}

function renderReflection(){
  const list = $('reflectHistory');
  const history = lsGet('rz-reflect', []);
  if(!history.length){ list.innerHTML=''; return; }
  list.innerHTML = '<h3 style="margin:0 0 8px">Riwayat</h3>' + history.map(r => `
    <div class="item" style="flex-direction:column;align-items:flex-start">
      <div style="font-size:13px;color:#8a7665">${r.date}</div>
      <div>${escapeHtml(r.text)}</div>
    </div>
  `).join('');
}

/* ========== MEMORIES ========== */
function addMemory(){
  const title = $('memTitle').value.trim();
  const text = $('memText').value.trim();
  if(!title && !text) return;
  const mems = lsGet('rz-mems', []);
  mems.unshift({
    id: Date.now(),
    title: title || 'Untitled',
    text,
    fav: false,
    photo: null,
    date: new Date().toLocaleDateString('id-ID', {day:'numeric',month:'short'})
  });
  lsSet('rz-mems', mems);
  $('memTitle').value = '';
  $('memText').value = '';
  renderMemories();
  renderFavorites();
  addPoint(3);
}

function renderMemories(){
  const list = $('memList');
  const mems = lsGet('rz-mems', []);
  if(!mems.length){
    list.innerHTML = '<p style="color:#8a7665">Belum ada memory.</p>';
    return;
  }
  list.innerHTML = mems.map(m => `
    <div class="item" style="flex-direction:column;align-items:flex-start">
      <div style="display:flex;justify-content:space-between;width:100%;gap:10px">
        <strong>${escapeHtml(m.title)}</strong>
        <div style="display:flex;gap:6px">
          <button class="secondary" style="padding:4px 8px" onclick="toggleFavMem(${m.id})">${m.fav?'★':'☆'}</button>
          <button class="secondary" style="padding:4px 8px" onclick="deleteMem(${m.id})">✕</button>
        </div>
      </div>
      <div style="font-size:13px;color:#8a7665">${m.date}</div>
      ${m.photo ? `<img src="${m.photo}" style="max-width:100%;border-radius:12px;margin:8px 0;border:1px solid var(--beige)">` : ''}
      <div>${escapeHtml(m.text || '')}</div>
    </div>
  `).join('');
}

function toggleFavMem(id){
  const mems = lsGet('rz-mems', []);
  const m = mems.find(x=>x.id===id);
  if(m){ m.fav = !m.fav; lsSet('rz-mems', mems); renderMemories(); renderFavorites(); }
}

function deleteMem(id){
  let mems = lsGet('rz-mems', []);
  mems = mems.filter(x=>x.id!==id);
  lsSet('rz-mems', mems);
  renderMemories();
  renderFavorites();
  renderPhotoGallery();
}

/* ========== QUOTES ========== */
function addQuote(){
  const text = $('quoteText').value.trim();
  const author = $('quoteAuthor').value.trim();
  if(!text) return;
  const quotes = lsGet('rz-quotes', []);
  quotes.unshift({
    id: Date.now(),
    text,
    author,
    fav: false
  });
  lsSet('rz-quotes', quotes);
  $('quoteText').value = '';
  $('quoteAuthor').value = '';
  renderQuotes();
  renderFavorites();
  addPoint(2);
}

function renderQuotes(){
  const list = $('quoteList');
  const quotes = lsGet('rz-quotes', []);
  if(!quotes.length){
    list.innerHTML = '<p style="color:#8a7665">Belum ada quote.</p>';
    return;
  }
  list.innerHTML = quotes.map(q => `
    <div class="item" style="flex-direction:column;align-items:flex-start">
      <div style="display:flex;justify-content:space-between;width:100%;gap:10px">
        <div style="font-style:italic">“${escapeHtml(q.text)}”</div>
        <div style="display:flex;gap:6px">
          <button class="secondary" style="padding:4px 8px" onclick="toggleFavQuote(${q.id})">${q.fav?'★':'☆'}</button>
          <button class="secondary" style="padding:4px 8px" onclick="deleteQuote(${q.id})">✕</button>
        </div>
      </div>
      ${q.author ? `<div style="font-size:13px;color:#8a7665">— ${escapeHtml(q.author)}</div>` : ''}
    </div>
  `).join('');
}

function toggleFavQuote(id){
  const quotes = lsGet('rz-quotes', []);
  const q = quotes.find(x=>x.id===id);
  if(q){ q.fav = !q.fav; lsSet('rz-quotes', quotes); renderQuotes(); renderFavorites(); }
}

function deleteQuote(id){
  let quotes = lsGet('rz-quotes', []);
  quotes = quotes.filter(x=>x.id!==id);
  lsSet('rz-quotes', quotes);
  renderQuotes();
  renderFavorites();
}

/* ========== FAVORITES ========== */
function renderFavorites(){
  const list = $('favList');
  const quotes = lsGet('rz-quotes', []).filter(q=>q.fav);
  const mems = lsGet('rz-mems', []).filter(m=>m.fav);
  if(!quotes.length && !mems.length){
    list.innerHTML = '<p style="color:#8a7665">Belum ada favorit. Kasih bintang ★ di Quotes atau Memories.</p>';
    return;
  }
  let html = '';
  quotes.forEach(q=>{
    html += `<div class="item" style="flex-direction:column;align-items:flex-start">
      <span class="tag">Quote</span>
      <div style="font-style:italic">“${escapeHtml(q.text)}”</div>
      ${q.author?`<div style="font-size:13px;color:#8a7665">— ${escapeHtml(q.author)}</div>`:''}
    </div>`;
  });
  mems.forEach(m=>{
    html += `<div class="item" style="flex-direction:column;align-items:flex-start">
      <span class="tag">Memory</span>
      <strong>${escapeHtml(m.title)}</strong>
      ${m.photo ? `<img src="${m.photo}" style="max-width:100%;border-radius:10px;margin:6px 0">` : ''}
      <div>${escapeHtml(m.text || '')}</div>
    </div>`;
  });
  list.innerHTML = html;
}

/* ============================================================
   GAMES (9)
   ============================================================ */
function startGame(name){
  const area = $('gameArea');
  area.style.display = 'block';
  if(window._catchInterval) clearInterval(window._catchInterval);
  if(window._breatheInterval) clearInterval(window._breatheInterval);

  if(musicPlaying && audioCtx && audioCtx.state === 'suspended'){
    audioCtx.resume();
  }

  const games = {
    memory: gameMemory,
    plant: gamePlant,
    tic: gameTic,
    rps: gameRPS,
    catch: gameCatch,
    color: gameColor,
    guess: gameGuess,
    breathe: gameBreathe,
    scramble: gameScramble
  };
  if(games[name]) games[name](area);
  area.scrollIntoView({behavior:'smooth'});
}

/* 1. Memory Match */
function gameMemory(area){
  area.innerHTML = `
    <h2>Memory Match 🃏</h2>
    <p>Find the matching pairs. +10 LP tiap pair.</p>
    <div class="board" id="memoryBoard"></div>
    <p id="memScore">Pairs: 0 / 3</p>
  `;
  const vals = ['🌿','🌿','🤎','🤎','🌱','🌱'];
  vals.sort(()=>Math.random()-0.5);
  let open = [];
  let pairs = 0;
  vals.forEach(v=>{
    const c = document.createElement('button');
    c.className = 'cell';
    c.textContent = '?';
    c.onclick = ()=>{
      if(open.length >= 2 || c.textContent !== '?') return;
      c.textContent = v;
      open.push(c);
      if(open.length === 2){
        setTimeout(()=>{
          if(open[0].textContent === open[1].textContent){
            pairs++;
            addPoint(10);
            $('memScore').textContent = `Pairs: ${pairs} / 3`;
            open[0].style.opacity = '0.5';
            open[1].style.opacity = '0.5';
            open[0].onclick = open[1].onclick = null;
            if(pairs === 3) $('memScore').textContent = 'Selesai! 🌿 +30 LP';
          } else {
            open.forEach(x => x.textContent = '?');
          }
          open = [];
        }, 500);
      }
    };
    $('memoryBoard').appendChild(c);
  });
}

/* 2. Little Plant */
let plantState = Number(localStorage.getItem('rz-plant') || 0);
function gamePlant(area){
  const stages = ['🌱','🌿','🪴','🌷','🌳'];
  area.innerHTML = `
    <h2>Little Plant 🌱</h2>
    <div style="font-size:90px" id="plant">${stages[plantState]}</div>
    <p id="plantText">${plantState === 0 ? 'Your plant is waiting.' : plantState === 4 ? 'Fully grown! 🌳' : 'Keep caring for it!'}</p>
    <div class="controls">
      <button class="primary" onclick="waterPlant()">💧 Water (+3 LP)</button>
      <button class="secondary" onclick="carePlant()">☀️ Sunlight (+2 LP)</button>
      <button class="secondary" onclick="resetPlant()">Reset</button>
    </div>
  `;
}
function waterPlant(){
  plantState = Math.min(4, plantState + 1);
  localStorage.setItem('rz-plant', plantState);
  const stages = ['🌱','🌿','🪴','🌷','🌳'];
  $('plant').textContent = stages[plantState];
  $('plantText').textContent = plantState === 4 ? 'Fully grown! 🌳' : 'Your little plant grew!';
  addPoint(3);
}
function carePlant(){
  $('plantText').textContent = 'It got some sunshine ☀️';
  addPoint(2);
}
function resetPlant(){
  plantState = 0;
  localStorage.setItem('rz-plant', 0);
  startGame('plant');
}

/* 3. Tic-Tac-Toe */
function gameTic(area){
  area.innerHTML = `
    <h2>Mini Tic-Tac-Toe ⭕</h2>
    <div class="board" id="ticBoard"></div>
    <p id="ticText">Your turn: X</p>
    <button class="secondary" onclick="startGame('tic')">Restart</button>
  `;
  let cells = Array(9).fill('');
  let turn = 'X';
  let over = false;
  for(let i=0;i<9;i++){
    const b = document.createElement('button');
    b.className = 'cell';
    b.onclick = ()=>{
      if(over || cells[i]) return;
      cells[i] = turn;
      b.textContent = turn;
      if(checkTic(cells)){
        over = true;
        return;
      }
      turn = turn === 'X' ? 'O' : 'X';
      $('ticText').textContent = 'Your turn: ' + turn;
    };
    $('ticBoard').appendChild(b);
  }
}
function checkTic(c){
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const w = wins.find(a => c[a[0]] && c[a[0]]===c[a[1]] && c[a[1]]===c[a[2]]);
  if(w){
    $('ticText').textContent = c[w[0]] + ' wins! 🌿 +10 LP';
    addPoint(10);
    return true;
  }
  if(c.every(Boolean)){
    $('ticText').textContent = 'Draw 🤎';
    return true;
  }
  return false;
}

/* 4. Rock Paper Scissors */
function gameRPS(area){
  area.innerHTML = `
    <h2>Rock Paper Scissors ✊</h2>
    <p id="rpsResult">Pilih senjatamu!</p>
    <div class="rps-btns">
      <button onclick="playRPS('rock')">✊</button>
      <button onclick="playRPS('paper')">🖐️</button>
      <button onclick="playRPS('scissors')">✌️</button>
    </div>
    <p id="rpsScore">Kamu 0 - 0 Bot</p>
  `;
  window._rpsYou = 0;
  window._rpsBot = 0;
}
function playRPS(you){
  const opts = ['rock','paper','scissors'];
  const bot = opts[Math.floor(Math.random()*3)];
  const emoji = {rock:'✊', paper:'🖐️', scissors:'✌️'};
  let result = '';
  if(you === bot) result = 'Seri!';
  else if(
    (you==='rock' && bot==='scissors') ||
    (you==='paper' && bot==='rock') ||
    (you==='scissors' && bot==='paper')
  ){
    result = 'Kamu menang! +5 LP';
    window._rpsYou++;
    addPoint(5);
  } else {
    result = 'Bot menang 😅';
    window._rpsBot++;
  }
  $('rpsResult').textContent = `Kamu ${emoji[you]} vs Bot ${emoji[bot]} — ${result}`;
  $('rpsScore').textContent = `Kamu ${window._rpsYou} - ${window._rpsBot} Bot`;
}

/* 5. Catch the Leaf */
function gameCatch(area){
  area.innerHTML = `
    <h2>Catch the Leaf 🍃</h2>
    <p>Klik daun yang jatuh! +2 LP per daun.</p>
    <p>Score: <b id="catchScore">0</b> · Time: <b id="catchTime">20</b>s</p>
    <div class="catch-area" id="catchArea"></div>
    <button class="secondary" onclick="startGame('catch')">Main lagi</button>
  `;
  let score = 0;
  let time = 20;
  const areaEl = $('catchArea');

  window._catchInterval = setInterval(()=>{
    time--;
    $('catchTime').textContent = time;
    if(time <= 0){
      clearInterval(window._catchInterval);
      areaEl.innerHTML = `<div style="display:grid;place-items:center;height:100%;font-size:20px">Selesai! Score: ${score} 🌿</div>`;
    }
  }, 1000);

  function spawn(){
    if(time <= 0) return;
    const leaf = document.createElement('div');
    leaf.className = 'falling-leaf';
    leaf.textContent = ['🍃','🌿','🍂'][Math.floor(Math.random()*3)];
    leaf.style.left = Math.random()*85 + '%';
    leaf.style.top = '-40px';
    areaEl.appendChild(leaf);

    let y = -40;
    const speed = 1.5 + Math.random()*2;
    const fall = setInterval(()=>{
      y += speed;
      leaf.style.top = y + 'px';
      if(y > 340){
        clearInterval(fall);
        leaf.remove();
      }
    }, 30);

    leaf.onclick = ()=>{
      clearInterval(fall);
      leaf.remove();
      score++;
      addPoint(2);
      $('catchScore').textContent = score;
    };
  }

  const spawner = setInterval(()=>{
    if(time <= 0){ clearInterval(spawner); return; }
    spawn();
  }, 600);
}

/* 6. Color Match */
function gameColor(area){
  const colors = [
    {name:'Emerald', hex:'#0F6B5B'},
    {name:'Teal', hex:'#168C83'},
    {name:'Brown', hex:'#6B4935'},
    {name:'Cream', hex:'#F5EFE3'},
    {name:'Beige', hex:'#D9CBB5'},
    {name:'Soft Green', hex:'#e8f5f1'}
  ];
  area.innerHTML = `
    <h2>Color Match 🎨</h2>
    <p>Warna apa ini? +5 LP kalau benar.</p>
    <div class="color-box" id="colorBox"></div>
    <p id="colorFeedback"></p>
    <div id="colorOptions" class="controls"></div>
    <p>Score: <b id="colorScore">0</b></p>
  `;
  let score = 0;

  function nextRound(){
    const correct = colors[Math.floor(Math.random()*colors.length)];
    $('colorBox').style.background = correct.hex;
    $('colorFeedback').textContent = '';

    let opts = [correct];
    while(opts.length < 3){
      const c = colors[Math.floor(Math.random()*colors.length)];
      if(!opts.find(o=>o.name===c.name)) opts.push(c);
    }
    opts.sort(()=>Math.random()-0.5);

    const box = $('colorOptions');
    box.innerHTML = '';
    opts.forEach(o=>{
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.textContent = o.name;
      btn.onclick = ()=>{
        if(o.name === correct.name){
          $('colorFeedback').textContent = 'Benar! 🌿';
          score++;
          addPoint(5);
          $('colorScore').textContent = score;
        } else {
          $('colorFeedback').textContent = `Salah, itu ${correct.name}`;
        }
        setTimeout(nextRound, 900);
      };
      box.appendChild(btn);
    });
  }
  nextRound();
}

/* 7. Number Guess */
function gameGuess(area){
  const secret = Math.floor(Math.random()*50) + 1;
  area.innerHTML = `
    <h2>Number Guess 🔢</h2>
    <p>Tebak angka 1–50. Kamu punya 7 kesempatan.</p>
    <div class="row" style="max-width:280px;margin:20px auto">
      <input id="guessInput" type="number" min="1" max="50" placeholder="Tebakanmu">
      <button class="primary" onclick="makeGuess()" style="flex:0 0 auto">Tebak</button>
    </div>
    <p id="guessFeedback"></p>
    <p>Sisa kesempatan: <b id="guessLeft">7</b></p>
  `;
  window._guessSecret = secret;
  window._guessLeft = 7;
}
function makeGuess(){
  const val = Number($('guessInput').value);
  if(!val || val < 1 || val > 50){
    $('guessFeedback').textContent = 'Masukkan angka 1–50';
    return;
  }
  window._guessLeft--;
  $('guessLeft').textContent = window._guessLeft;

  if(val === window._guessSecret){
    $('guessFeedback').textContent = `Benar! Angkanya ${window._guessSecret} 🌿 +15 LP`;
    addPoint(15);
    $('guessInput').disabled = true;
  } else if(window._guessLeft <= 0){
    $('guessFeedback').textContent = `Habis! Angkanya ${window._guessSecret}`;
    $('guessInput').disabled = true;
  } else if(val < window._guessSecret){
    $('guessFeedback').textContent = 'Terlalu kecil ⬆️';
  } else {
    $('guessFeedback').textContent = 'Terlalu besar ⬇️';
  }
}

/* 8. Breathing */
function gameBreathe(area){
  area.innerHTML = `
    <h2>Breathing 🧘</h2>
    <p>Ikuti lingkaran. Tarik napas 4 detik, hembuskan 4 detik.</p>
    <div class="breathe-circle" id="breatheCircle">Siap</div>
    <p id="breatheText">Tekan mulai</p>
    <div class="controls">
      <button class="primary" id="btnBreathe" onclick="toggleBreathe()">Mulai</button>
    </div>
  `;
  window._breathing = false;
}
function toggleBreathe(){
  const circle = $('breatheCircle');
  const text = $('breatheText');
  const btn = $('btnBreathe');

  if(window._breathing){
    window._breathing = false;
    clearInterval(window._breatheInterval);
    circle.className = 'breathe-circle';
    circle.textContent = 'Siap';
    text.textContent = 'Berhenti';
    btn.textContent = 'Mulai';
    return;
  }

  window._breathing = true;
  btn.textContent = 'Stop';
  let phase = 'inhale';
  circle.className = 'breathe-circle inhale';
  circle.textContent = 'Inhale';
  text.textContent = 'Tarik napas...';

  window._breatheInterval = setInterval(()=>{
    if(phase === 'inhale'){
      phase = 'exhale';
      circle.className = 'breathe-circle exhale';
      circle.textContent = 'Exhale';
      text.textContent = 'Hembuskan...';
    } else {
      phase = 'inhale';
      circle.className = 'breathe-circle inhale';
      circle.textContent = 'Inhale';
      text.textContent = 'Tarik napas...';
      addPoint(1);
    }
  }, 4000);
}

/* 9. Word Scramble */
function gameScramble(area){
  const words = [
    {word:'JOURNAL', hint:'Buku catatan'},
    {word:'GROWTH', hint:'Pertumbuhan'},
    {word:'CALM', hint:'Tenang'},
    {word:'LEAF', hint:'Daun'},
    {word:'MEMORY', hint:'Kenangan'},
    {word:'GRATEFUL', hint:'Bersyukur'},
    {word:'PEACE', hint:'Damai'},
    {word:'BLOOM', hint:'Mekar'}
  ];
  const pick = words[Math.floor(Math.random()*words.length)];
  const scrambled = pick.word.split('').sort(()=>Math.random()-0.5).join('');

  area.innerHTML = `
    <h2>Word Scramble 🧩</h2>
    <p>Susun huruf jadi kata yang benar.</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:var(--emerald)">${scrambled}</p>
    <p style="color:#7d6958">Hint: ${pick.hint}</p>
    <div class="row" style="max-width:300px;margin:16px auto">
      <input id="scrambleInput" placeholder="Jawabanmu" style="text-transform:uppercase">
      <button class="primary" onclick="checkScramble()" style="flex:0 0 auto">Cek</button>
    </div>
    <p id="scrambleFeedback"></p>
    <button class="secondary" onclick="startGame('scramble')">Kata baru</button>
  `;
  window._scrambleWord = pick.word;
}
function checkScramble(){
  const ans = ($('scrambleInput').value || '').trim().toUpperCase();
  if(ans === window._scrambleWord){
    $('scrambleFeedback').textContent = 'Benar! 🌿 +10 LP';
    addPoint(10);
  } else {
    $('scrambleFeedback').textContent = 'Belum tepat, coba lagi';
  }
}

/* ============================================================
   PHOTOBOOTH
   ============================================================ */
let camStream = null;
let currentFilter = 'none';
let photoDataUrl = null;

async function startCamera(){
  try{
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    const video = $('cam');
    video.srcObject = camStream;
    video.style.display = 'block';
    $('photoPreview').style.display = 'none';
    $('btnSnap').disabled = false;
    $('btnStartCam').textContent = 'Kamera aktif';
    $('btnRetake').style.display = 'none';
    $('btnSavePhoto').style.display = 'none';
    $('btnDownload').style.display = 'none';
    applyFilterClass();
  }catch(err){
    alert('Tidak bisa akses kamera. Pastikan izin kamera diizinkan & pakai HTTPS / localhost.');
    console.error(err);
  }
}

function applyFilterClass(){
  const video = $('cam');
  const preview = $('photoPreview');
  [video, preview].forEach(el=>{
    el.className = '';
    el.classList.add('cam-filter-' + currentFilter);
  });
}

function setFilter(name){
  currentFilter = name;
  document.querySelectorAll('.filter-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.filter === name);
  });
  applyFilterClass();
}

function takePhoto(){
  const video = $('cam');
  const canvas = $('photoCanvas');
  const preview = $('photoPreview');

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');

  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);

  photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);

  preview.src = photoDataUrl;
  preview.style.display = 'block';
  video.style.display = 'none';
  applyFilterClass();

  $('btnSnap').disabled = true;
  $('btnRetake').style.display = 'inline-block';
  $('btnSavePhoto').style.display = 'inline-block';
  $('btnDownload').style.display = 'inline-block';
}

function retakePhoto(){
  photoDataUrl = null;
  $('photoPreview').style.display = 'none';
  $('cam').style.display = 'block';
  $('btnSnap').disabled = false;
  $('btnRetake').style.display = 'none';
  $('btnSavePhoto').style.display = 'none';
  $('btnDownload').style.display = 'none';
  $('stickerLayer').innerHTML = '';
  if(!camStream) startCamera();
}

function stopCamera(){
  if(camStream){
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
}

function addSticker(emoji){
  const layer = $('stickerLayer');
  const el = document.createElement('div');
  el.className = 'placed';
  el.textContent = emoji;
  el.style.left = (30 + Math.random()*40) + '%';
  el.style.top = (20 + Math.random()*40) + '%';
  let dragging = false;
  el.onpointerdown = e => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if(!dragging) return;
    const parent = layer.getBoundingClientRect();
    el.style.left = (e.clientX - parent.left - (el.offsetWidth/2)) + 'px';
    el.style.top = (e.clientY - parent.top - (el.offsetHeight/2)) + 'px';
  };
  el.onpointerup = () => { dragging = false; };
  layer.appendChild(el);
}

function savePhotoToMemories(){
  if(!photoDataUrl) return;

  const canvas = $('photoCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1,0,0,1,0,0);

    const layer = $('stickerLayer');
    const stickers = layer.querySelectorAll('.placed');
    const rect = layer.getBoundingClientRect();
    stickers.forEach(s=>{
      const sx = parseFloat(s.style.left) || 0;
      const sy = parseFloat(s.style.top) || 0;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      ctx.font = `${36 * scaleX}px serif`;
      ctx.fillText(s.textContent, sx * scaleX, (sy * scaleY) + 30*scaleY);
    });

    const finalUrl = canvas.toDataURL('image/jpeg', 0.9);

    const mems = lsGet('rz-mems', []);
    mems.unshift({
      id: Date.now(),
      title: 'Photobooth ' + new Date().toLocaleDateString('id-ID'),
      text: 'Foto dari Photobooth 📸',
      photo: finalUrl,
      fav: false,
      date: new Date().toLocaleDateString('id-ID', {day:'numeric',month:'short'})
    });
    lsSet('rz-mems', mems);
    renderMemories();
    renderFavorites();
    renderPhotoGallery();
    addPoint(5);
    alert('Foto disimpan ke Memories! 📸');
  };
  img.src = photoDataUrl;
}

function downloadPhoto(){
  if(!photoDataUrl) return;
  const a = document.createElement('a');
  a.href = photoDataUrl;
  a.download = 'rezzjournal-photo-' + Date.now() + '.jpg';
  a.click();
}

function renderPhotoGallery(){
  const gallery = $('photoGallery');
  const mems = lsGet('rz-mems', []).filter(m => m.photo);
  if(!mems.length){
    gallery.innerHTML = '<p style="color:#8a7665;font-size:14px">Belum ada foto.</p>';
    return;
  }
  gallery.innerHTML = mems.slice(0,12).map(m =>
    `<img src="${m.photo}" alt="${escapeHtml(m.title)}" title="${escapeHtml(m.title)}">`
  ).join('');
}

/* ========== INIT ========== */
selectDay(current);
renderFavorites();
renderPhotoGallery();
openTool('calendar');
