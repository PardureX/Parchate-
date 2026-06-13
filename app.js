/* ============================================
   PARCHATE™ — app.js
   ============================================ */

'use strict';

// ============================================
// ESTADO CENTRAL
// ============================================
const state = {
  tracks: [],
  currentIndex: -1,
  isPlaying: false,
  shuffle: false,
  repeat: false,        // 'none' | 'one' | 'all'
  repeatMode: 'none',
  volume: 1,
  gain: 1,
  eq: { bass: 0, mid: 0, treble: 0 },
  theme: {
    accent: '#a78bfa',
    darkMode: true,
    bgPhoto: null
  },
  duration: 0,
  currentTime: 0
};

// ============================================
// WEB AUDIO API — cadena de nodos
// AudioSource → GainNode → Bass → Mid → Treble → Destination
// ============================================
let audioCtx = null;
let sourceNode = null;
let gainNode = null;
let bassFilter = null;
let midFilter = null;
let trebleFilter = null;

function initAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = document.getElementById('audioEl');

  sourceNode = audioCtx.createMediaElementSource(audio);
  gainNode = audioCtx.createGain();

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 80;

  midFilter = audioCtx.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 8000;

  // Conectar la cadena
  sourceNode
    .connect(gainNode)
    .connect(bassFilter)
    .connect(midFilter)
    .connect(trebleFilter)
    .connect(audioCtx.destination);
}

function applyAudioState() {
  if (!gainNode) return;
  gainNode.gain.setTargetAtTime(state.gain, audioCtx.currentTime, 0.01);
  bassFilter.gain.setTargetAtTime(state.eq.bass, audioCtx.currentTime, 0.01);
  midFilter.gain.setTargetAtTime(state.eq.mid, audioCtx.currentTime, 0.01);
  trebleFilter.gain.setTargetAtTime(state.eq.treble, audioCtx.currentTime, 0.01);
}

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const audioEl        = document.getElementById('audioEl');
const playBtn        = document.getElementById('playBtn');
const iconPlay       = document.getElementById('iconPlay');
const iconPause      = document.getElementById('iconPause');
const prevBtn        = document.getElementById('prevBtn');
const nextBtn        = document.getElementById('nextBtn');
const shuffleBtn     = document.getElementById('shuffleBtn');
const repeatBtn      = document.getElementById('repeatBtn');
const progressFill   = document.getElementById('progressFill');
const progressWrap   = document.getElementById('progressWrap');
const timeCurrentEl  = document.getElementById('timeCurrentEl');
const timeTotalEl    = document.getElementById('timeTotalEl');
const volumeSlider   = document.getElementById('volumeSlider');
const songTitle      = document.getElementById('songTitle');
const songArtist     = document.getElementById('songArtist');
const coverBadge     = document.getElementById('coverBadge');
const coverDefault   = document.getElementById('coverDefault');
const coverImg       = document.getElementById('coverImg');
const tracklist      = document.getElementById('tracklist');
const fileInput      = document.getElementById('fileInput');
const loadZone       = document.getElementById('loadZone');
const gainSlider     = document.getElementById('gainSlider');
const gainLabel      = document.getElementById('gainLabel');
const bassSlider     = document.getElementById('bassSlider');
const midSlider      = document.getElementById('midSlider');
const trebleSlider   = document.getElementById('trebleSlider');
const bassLabel      = document.getElementById('bassLabel');
const midLabel       = document.getElementById('midLabel');
const trebleLabel    = document.getElementById('trebleLabel');
const coverPhotoBtn  = document.getElementById('coverPhotoBtn');
const bgPhotoInput   = document.getElementById('bgPhotoInput');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// ============================================
// RENDER — actualiza la UI desde el estado
// ============================================
function render() {
  // --- Play / Pause ---
  iconPlay.style.display  = state.isPlaying ? 'none' : 'block';
  iconPause.style.display = state.isPlaying ? 'block' : 'none';

  // --- Botones activos ---
  shuffleBtn.classList.toggle('active', state.shuffle);
  repeatBtn.classList.toggle('active', state.repeatMode !== 'none');

  // --- Progreso ---
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  progressFill.style.width = pct.toFixed(2) + '%';
  timeCurrentEl.textContent = formatTime(state.currentTime);
  timeTotalEl.textContent   = formatTime(state.duration);

  // --- Volumen ---
  volumeSlider.value = state.volume;

  // --- Info canción ---
  if (state.currentIndex >= 0 && state.tracks[state.currentIndex]) {
    const t = state.tracks[state.currentIndex];
    songTitle.textContent  = t.title;
    songArtist.textContent = t.artist || 'Desconocido';
    coverBadge.textContent = (state.currentIndex + 1) + ' / ' + state.tracks.length;
    if (t.cover) {
      coverImg.src = t.cover;
      coverImg.style.display = 'block';
      coverDefault.style.display = 'none';
    } else {
      coverImg.style.display = 'none';
      coverDefault.style.display = 'flex';
    }
  } else {
    songTitle.textContent  = 'Selecciona una canción';
    songArtist.textContent = '—';
    coverBadge.textContent = '0 / ' + state.tracks.length;
    coverImg.style.display = 'none';
    coverDefault.style.display = 'flex';
  }

  // --- EQ labels ---
  gainLabel.textContent  = state.gain.toFixed(1) + 'x';
  gainSlider.value       = state.gain;
  bassLabel.textContent  = fmtDb(state.eq.bass);
  midLabel.textContent   = fmtDb(state.eq.mid);
  trebleLabel.textContent = fmtDb(state.eq.treble);
  bassSlider.value       = state.eq.bass;
  midSlider.value        = state.eq.mid;
  trebleSlider.value     = state.eq.treble;

  // --- Tracklist ---
  renderTracklist();

  // --- Tema ---
  document.documentElement.style.setProperty('--ac', state.theme.accent);
  document.documentElement.setAttribute('data-theme', state.theme.darkMode ? 'dark' : 'light');

  // --- Fondo personalizado ---
  const coverZone = document.getElementById('coverZone');
  if (state.theme.bgPhoto) {
    coverDefault.style.backgroundImage = 'url(' + state.theme.bgPhoto + ')';
    coverDefault.style.backgroundSize = 'cover';
    coverDefault.style.backgroundPosition = 'center';
  }
}

function renderTracklist() {
  tracklist.innerHTML = '';
  if (state.tracks.length === 0) {
    tracklist.innerHTML = '<li style="text-align:center;padding:2rem;color:var(--txt-3);font-size:13px">No hay canciones aún</li>';
    return;
  }
  state.tracks.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'track-item' + (i === state.currentIndex ? ' playing' : '');
    li.innerHTML =
      '<span class="track-num">' + (i === state.currentIndex ? '▶' : (i + 1)) + '</span>' +
      '<div class="track-info">' +
        '<div class="track-name">' + escHtml(track.title) + '</div>' +
        '<div class="track-artist">' + escHtml(track.artist || 'Desconocido') + '</div>' +
      '</div>' +
      '<span class="track-duration">' + formatTime(track.duration || 0) + '</span>';
    li.addEventListener('click', () => loadTrack(i, true));
    tracklist.appendChild(li);
  });
}

// ============================================
// UTILIDADES
// ============================================
function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function fmtDb(val) {
  return (val > 0 ? '+' : '') + val + ' dB';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function saveToStorage() {
  try {
    localStorage.setItem('parchate_gain', state.gain);
    localStorage.setItem('parchate_eq', JSON.stringify(state.eq));
    localStorage.setItem('parchate_accent', state.theme.accent);
    localStorage.setItem('parchate_dark', state.theme.darkMode);
    localStorage.setItem('parchate_volume', state.volume);
    localStorage.setItem('parchate_repeat', state.repeatMode);
    localStorage.setItem('parchate_shuffle', state.shuffle);
  } catch(e) {}
}

function loadFromStorage() {
  try {
    const gain = parseFloat(localStorage.getItem('parchate_gain'));
    if (!isNaN(gain)) state.gain = gain;
    const eq = JSON.parse(localStorage.getItem('parchate_eq'));
    if (eq) state.eq = eq;
    const accent = localStorage.getItem('parchate_accent');
    if (accent) state.theme.accent = accent;
    const dark = localStorage.getItem('parchate_dark');
    if (dark !== null) state.theme.darkMode = dark === 'true';
    const vol = parseFloat(localStorage.getItem('parchate_volume'));
    if (!isNaN(vol)) state.volume = vol;
    const repeat = localStorage.getItem('parchate_repeat');
    if (repeat) state.repeatMode = repeat;
    const shuffle = localStorage.getItem('parchate_shuffle');
    if (shuffle !== null) state.shuffle = shuffle === 'true';
  } catch(e) {}
}

// ============================================
// CARGAR TRACKS
// ============================================
function loadFiles(files) {
  const fileArr = Array.from(files);
  let loaded = 0;

  fileArr.forEach(file => {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '');
    const track = { url, title: name, artist: '', duration: 0, cover: null };

    // Leer duración con audio temporal
    const tmpAudio = new Audio();
    tmpAudio.src = url;
    tmpAudio.addEventListener('loadedmetadata', () => {
      track.duration = tmpAudio.duration;
      loaded++;
      if (loaded === fileArr.length) {
        state.tracks.push(...fileArr.map((_, i) => state.tracks[state.tracks.length - fileArr.length + i] || track));
        render();
      }
    }, { once: true });

    // Intentar leer metadata ID3 con jsmediatags si está disponible
    if (window.jsmediatags) {
      window.jsmediatags.read(file, {
        onSuccess: function(tag) {
          const tags = tag.tags;
          if (tags.title) track.title = tags.title;
          if (tags.artist) track.artist = tags.artist;
          if (tags.picture) {
            const pic = tags.picture;
            const base64 = pic.data.reduce((acc, b) => acc + String.fromCharCode(b), '');
            track.cover = 'data:' + pic.format + ';base64,' + btoa(base64);
          }
          render();
        },
        onError: function() {}
      });
    }

    state.tracks.push(track);
  });

  if (state.currentIndex < 0 && fileArr.length > 0) {
    loadTrack(0, false);
  }

  render();
}

// ============================================
// REPRODUCCIÓN
// ============================================
function loadTrack(index, autoPlay) {
  if (index < 0 || index >= state.tracks.length) return;
  state.currentIndex = index;
  const track = state.tracks[index];
  audioEl.src = track.url;
  audioEl.volume = state.volume;
  state.isPlaying = false;
  state.currentTime = 0;
  state.duration = 0;
  render();
  if (autoPlay) play();
}

function play() {
  if (!audioEl.src) return;
  initAudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioEl.play().then(() => {
    state.isPlaying = true;
    render();
  }).catch(() => {});
}

function pause() {
  audioEl.pause();
  state.isPlaying = false;
  render();
}

function togglePlay() {
  if (state.isPlaying) pause(); else play();
}

function prevTrack() {
  if (state.tracks.length === 0) return;
  if (state.currentTime > 3) {
    audioEl.currentTime = 0;
    return;
  }
  let idx = state.currentIndex - 1;
  if (idx < 0) idx = state.tracks.length - 1;
  loadTrack(idx, state.isPlaying);
}

function nextTrack() {
  if (state.tracks.length === 0) return;
  let idx;
  if (state.shuffle) {
    idx = Math.floor(Math.random() * state.tracks.length);
  } else {
    idx = state.currentIndex + 1;
    if (idx >= state.tracks.length) idx = 0;
  }
  loadTrack(idx, state.isPlaying);
}

// ============================================
// EVENTOS — REPRODUCTOR
// ============================================
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);

shuffleBtn.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  saveToStorage();
  render();
});

repeatBtn.addEventListener('click', () => {
  const modes = ['none', 'all', 'one'];
  const idx = modes.indexOf(state.repeatMode);
  state.repeatMode = modes[(idx + 1) % modes.length];
  saveToStorage();
  render();
});

volumeSlider.addEventListener('input', () => {
  state.volume = parseFloat(volumeSlider.value);
  audioEl.volume = state.volume;
  saveToStorage();
});

// Progreso — click para seek
progressWrap.addEventListener('click', (e) => {
  if (!state.duration) return;
  const rect = progressWrap.querySelector('.progress-bar-bg').getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioEl.currentTime = pct * state.duration;
});

// Actualizar progreso mientras suena
audioEl.addEventListener('timeupdate', () => {
  state.currentTime = audioEl.currentTime;
  render();
});

audioEl.addEventListener('loadedmetadata', () => {
  state.duration = audioEl.duration;
  render();
});

audioEl.addEventListener('ended', () => {
  if (state.repeatMode === 'one') {
    audioEl.currentTime = 0;
    play();
  } else if (state.repeatMode === 'all' || state.currentIndex < state.tracks.length - 1) {
    nextTrack();
  } else {
    state.isPlaying = false;
    render();
  }
});

// ============================================
// EVENTOS — ECUALIZADOR
// ============================================
gainSlider.addEventListener('input', () => {
  state.gain = parseFloat(gainSlider.value);
  applyAudioState();
  saveToStorage();
  render();
});

bassSlider.addEventListener('input', () => {
  state.eq.bass = parseInt(bassSlider.value);
  applyAudioState();
  saveToStorage();
  render();
});

midSlider.addEventListener('input', () => {
  state.eq.mid = parseInt(midSlider.value);
  applyAudioState();
  saveToStorage();
  render();
});

trebleSlider.addEventListener('input', () => {
  state.eq.treble = parseInt(trebleSlider.value);
  applyAudioState();
  saveToStorage();
  render();
});

// Presets
const PRESETS = {
  flat:     { bass: 0,   mid: 0,  treble: 0  },
  bass:     { bass: 8,   mid: 2,  treble: -2 },
  vocal:    { bass: -2,  mid: 6,  treble: 3  },
  parlante: { bass: -3,  mid: 4,  treble: 6  },
  audifono: { bass: 4,   mid: 0,  treble: 5  }
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    state.eq = { ...preset };
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyAudioState();
    saveToStorage();
    render();
  });
});

// ============================================
// EVENTOS — TEMA Y PERSONALIZACIÓN
// ============================================
document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    state.theme.accent = sw.dataset.color;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    saveToStorage();
    render();
  });
});

themeToggleBtn.addEventListener('click', () => {
  state.theme.darkMode = !state.theme.darkMode;
  saveToStorage();
  render();
});

// Foto de fondo
coverPhotoBtn.addEventListener('click', () => bgPhotoInput.click());
bgPhotoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.theme.bgPhoto = ev.target.result;
    render();
  };
  reader.readAsDataURL(file);
});

// ============================================
// EVENTOS — CARGAR CANCIONES
// ============================================
loadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    loadFiles(e.target.files);
  }
});

// Drag & drop
loadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  loadZone.style.borderColor = state.theme.accent;
});

loadZone.addEventListener('dragleave', () => {
  loadZone.style.borderColor = '';
});

loadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  loadZone.style.borderColor = '';
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
  if (files.length > 0) loadFiles(files);
});

// ============================================
// TABS
// ============================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ============================================
// TECLADO (para cuando estén en PC)
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') nextTrack();
  if (e.code === 'ArrowLeft') prevTrack();
});

// ============================================
// INICIALIZACIÓN
// ============================================
loadFromStorage();
render();

// Actualizar swatch activo según color guardado
document.querySelectorAll('.swatch').forEach(sw => {
  sw.classList.toggle('active', sw.dataset.color === state.theme.accent);
});

console.log('%cParchate™ listo 🎵', 'color:' + state.theme.accent + ';font-size:16px;font-weight:bold');
