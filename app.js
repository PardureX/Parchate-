/* ============================================
   PARCHATE™ — app.js (Actualizado con Buscador de Audio Libre)
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

// Instancia pública y estable de Invidious (Filtro limpiador de anuncios)
const INVIDIOUS_INSTANCE = 'https://inv.tux.digital'; 

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

  // Conectar la cadena nativa
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

// Elementos del nuevo buscador
const ytSearchInput  = document.getElementById('ytSearchInput');
const ytSearchBtn    = document.getElementById('ytSearchBtn');
const ytResults      = document.getElementById('ytResults');

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
    
    // Actualizar controles nativos de la pantalla de bloqueo en el celular
    actualizarPantallaDeBloqueo(t);
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
// CARGAR TRACKS (LOCALES)
// ============================================
function loadFiles(files) {
  const fileArr = Array.from(files);
  let loaded = 0;

  fileArr.forEach(file => {
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '');
    const track = { url, title: name, artist: 'Local', duration: 0, cover: null };

    const tmpAudio = new Audio();
    tmpAudio.src = url;
    tmpAudio.addEventListener('loadedmetadata', () => {
      track.duration = tmpAudio.duration;
      loaded++;
      if (loaded === fileArr.length) {
        render();
      }
    }, { once: true });

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
        }
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
// LOGICA DEL MOTOR DE BÚSQUEDA (SIN ANUNCIOS)
// ============================================
async function buscarMusicaOnline() {
  const query = ytSearchInput.value.trim();
  if (!query) return;

  ytResults.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--txt-3);font-size:14px">Buscando en el servidor limpio...</div>';

  try {
    const res = await fetch(`${INVIDIOUS_INSTANCE}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    const videos = await res.json();

    if (!videos || videos.length === 0) {
      ytResults.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--txt-3)">No se encontraron pistas limpias.</div>';
      return;
    }

    ytResults.innerHTML = ''; 

    videos.slice(0, 6).forEach(video => {
      const card = document.createElement('div');
      card.className = 'yt-result-card';
      
      const thumbnail = video.videoThumbnails ? video.videoThumbnails.find(t => t.quality === 'medium')?.url || video.videoThumbnails[0].url : '';

      card.innerHTML = `
        <img src="${thumbnail}" class="yt-card-thumb" alt="Cover">
        <div class="yt-card-info">
          <div class="yt-card-title">${escHtml(video.title)}</div>
          <div class="yt-card-author">${escHtml(video.author)}</div>
          <div class="yt-card-duration">${formatTime(video.lengthSeconds)}</div>
        </div>
        <button class="yt-card-add-btn">▶ Escuchar</button>
      `;

      card.addEventListener('click', () => {
        const nuevoTrack = {
          url: `${INVIDIOUS_INSTANCE}/latest_version?id=${video.videoId}&listen=1`,
          title: video.title,
          artist: video.author,
          duration: video.lengthSeconds,
          cover: thumbnail
        };

        state.tracks.push(nuevoTrack);
        const indexAsignado = state.tracks.length - 1;
        loadTrack(indexAsignado, true);
        
        const btn = card.querySelector('.yt-card-add-btn');
        btn.textContent = '🎵 Sonando';
        btn.style.background = 'var(--ac)';
      });

      ytResults.appendChild(card);
    });

  } catch (error) {
    ytResults.innerHTML = '<div style="text-align:center;padding:2rem;color:#f87171">Error de conexión con el motor. Intenta de nuevo.</div>';
  }
}

ytSearchBtn.addEventListener('click', buscarMusicaOnline);
ytSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buscarMusicaOnline();
});

// ============================================
// MEDIASESSION API (ESCUCHAR CON PANTALLA APAGADA)
// ============================================
function actualizarPantallaDeBloqueo(track) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || 'Parchate™',
      album: 'Streaming Sin Anuncios',
      artwork: [
        { src: track.cover || 'https://images.unsplash.com/photo-1614680376593-902f74fa0d41?q=80&w=250&auto=format&fit=crop', sizes: '256x256', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
  }
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
  state.duration = track.duration || 0;
  render();
  if (autoPlay) play();
}

function play() {
  if (!audioEl.src) return;
  initAudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioEl.play().then(() => {
    state.isPlaying = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    render();
  }).catch(() => {});
}

function pause() {
  audioEl.pause();
  state.isPlaying = false;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
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

progressWrap.addEventListener('click', (e) => {
  if (!state.duration) return;
  const rect = progressWrap.querySelector('.progress-bar-bg').getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audioEl.currentTime = pct * state.duration;
});

audioEl.addEventListener('timeupdate', () => {
  state.currentTime = audioEl.currentTime;
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  progressFill.style.width = pct.toFixed(2) + '%';
  timeCurrentEl.textContent = formatTime(state.currentTime);
});

audioEl.addEventListener('loadedmetadata', () => {
  state.duration = audioEl.duration;
  timeTotalEl.textContent = formatTime(state.duration);
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
// EVENTOS — CARGAR CANCIONES (LOCALES)
// ============================================
loadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) loadFiles(e.target.files);
});

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
// RE-ESTRUCTURACIÓN DINÁMICA DE PESTAÑAS (TABS)
// Corrección: Soporte universal para la rueda de configuraciones
// ============================================
const elementosNavegacion = document.querySelectorAll('.tab, #configBtn, [data-tab="config"]');

elementosNavegacion.forEach(tab => {
  tab.addEventListener('click', () => {
    // 1. Quitar estado activo a todos los botones de navegación
    elementosNavegacion.forEach(t => t.classList.remove('active'));
    
    // 2. Ocultar todos los paneles de la app por completo
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none'; 
    });
    
    // 3. Activar visualmente el botón presionado
    tab.classList.add('active');
    
    // 4. Buscar y mostrar el panel correspondiente (id="tab-config" o id="config")
    const destino = tab.dataset.tab;
    const panelDestino = document.getElementById('tab-' + destino) || document.getElementById(destino);
    
    if (panelDestino) {
      panelDestino.classList.add('active');
      panelDestino.style.display = 'block'; 
      
      // Si entramos al reproductor, recalculamos el canvas de la calavera de inmediato
      if (destino === 'player') {
        setTimeout(redimensionarMonitor, 50);
      }
    } else {
      console.warn(`Parchate™ Info: No se encontró el panel para la pestaña "${destino}". Verifica el ID en tu HTML.`);
    }
  });
});

// Asegurar el estado inicial de los paneles al arrancar
document.querySelectorAll('.tab-panel').forEach(p => {
  if (!p.classList.contains('active')) p.style.display = 'none';
});

// ============================================
// TECLADO (PC)
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

document.querySelectorAll('.swatch').forEach(sw => {
  sw.classList.toggle('active', sw.dataset.color === state.theme.accent);
});

console.log('%cParchate™ listo y blindado contra anuncios 🎵', 'color:' + state.theme.accent + ';font-size:16px;font-weight:bold');


// =======================================================================
// MOTOR VISUAL: CALAVERA REALISTA 3D + NOTAS DESDE LA GARGANTA
// =======================================================================
const heartCanvas = document.getElementById('heartMonitorCanvas');
const heartCtx = heartCanvas ? heartCanvas.getContext('2d') : null;

let heartAnalyser = null;
let heartDataArray = [];
let notasMusicalesArray = [];

const ICONOS_NOTAS = ['♩', '♪', '♫', '♬', '♭', '♮'];

const calaveraRealista = new Image();
calaveraRealista.src = 'calavera.png'; 

function redimensionarMonitor() {
  if (heartCanvas && heartCanvas.offsetWidth > 0) {
    heartCanvas.width = heartCanvas.offsetWidth;
    heartCanvas.height = heartCanvas.offsetHeight;
  }
}
window.addEventListener('resize', redimensionarMonitor);
setTimeout(redimensionarMonitor, 100);

function engancharMonitorCardiaco() {
  if (audioCtx && !heartAnalyser) {
    heartAnalyser = audioCtx.createAnalyser();
    heartAnalyser.fftSize = 64;
    const bufferLength = heartAnalyser.frequencyBinCount;
    heartDataArray = new Uint8Array(bufferLength);
    if (trebleFilter) trebleFilter.connect(heartAnalyser);
  }
}

function generarNotaMusical(x, y, color) {
  const angulo = (Math.random() * Math.PI * 0.6) + Math.PI * 1.1; 
  const velocidad = 2.0 + Math.random() * 3.5;
  
  notasMusicalesArray.push({
    x: x,
    y: y,
    texto: ICONOS_NOTAS[Math.floor(Math.random() * ICONOS_NOTAS.length)],
    vx: Math.cos(angulo) * velocidad,
    vy: Math.sin(angulo) * velocidad - 0.8, 
    opacidad: 1,
    tamano: 14 + Math.random() * 18,
    color: color
  });
}

function animarMonitorSignosVitales() {
  requestAnimationFrame(animarMonitorSignosVitales);
  
  if (!heartCanvas || !heartCtx) return;
  
  const W = heartCanvas.width;
  const H = heartCanvas.height;
  
  if (W === 0 && heartCanvas.offsetWidth > 0) {
    redimensionarMonitor();
    return;
  }
  
  heartCtx.fillStyle = 'rgba(13, 13, 13, 0.25)';
  heartCtx.fillRect(0, 0, W, H);
  
  let energiaBajos = 0;
  if (heartAnalyser && state.isPlaying) {
    heartAnalyser.getByteFrequencyData(heartDataArray);
    energiaBajos = (heartDataArray[0] + heartDataArray[1] + heartDataArray[2]) / 3;
  }
  
  const factorPulso = energiaBajos / 255;
  const colorActualApp = state.theme.accent || '#a78bfa';
  
  const centroX = W / 2;
  const centroY = H / 2;

  const gargantaX = centroX + 15;
  const gargantaY = centroY + 40;

  if (factorPulso > 0.32 && Math.random() < 0.5) {
    generarNotaMusical(gargantaX, gargantaY, colorActualApp);
  }
  
  for (let i = notasMusicalesArray.length - 1; i >= 0; i--) {
    const n = notasMusicalesArray[i];
    n.x += n.vx;
    n.y += n.vy;
    n.opacidad -= 0.015;
    
    if (n.opacidad <= 0) {
      notasMusicalesArray.splice(i, 1);
      continue;
    }
    
    heartCtx.save();
    heartCtx.globalAlpha = n.opacidad;
    heartCtx.fillStyle = n.color;
    heartCtx.font = `bold ${n.tamano}px sans-serif`;
    heartCtx.shadowBlur = 10;
    heartCtx.shadowColor = n.color;
    heartCtx.fillText(n.texto, n.x, n.y);
    heartCtx.restore();
  }
  
  const anchoCalavera = 165 + (factorPulso * 30);
  const altoCalavera = 165 + (factorPulso * 30);
  
  heartCtx.save();
  heartCtx.shadowBlur = 20 + (factorPulso * 25);
  heartCtx.shadowColor = colorActualApp;
  heartCtx.globalAlpha = 0.88 + (factorPulso * 0.12);

  if (calaveraRealista.complete) {
    heartCtx.drawImage(
      calaveraRealista, 
      centroX - anchoCalavera / 2, 
      centroY - altoCalavera / 2 - 10, 
      anchoCalavera, 
      altoCalavera
    );
  } else {
    heartCtx.fillStyle = colorActualApp;
    heartCtx.font = '13px sans-serif';
    heartCtx.fillText('Cargando arte...', centroX - 45, centroY);
  }
  
  heartCtx.restore();

  if (state.currentIndex >= 0 && state.tracks[state.currentIndex]) {
    const trackActual = state.tracks[state.currentIndex];
    
    heartCtx.save();
    heartCtx.fillStyle = '#ffffff';
    heartCtx.textAlign = 'center';
    
    heartCtx.font = 'bold 14px sans-serif';
    heartCtx.fillText(trackActual.title, centroX, H - 25);
    
    heartCtx.fillStyle = '#a3a3a3';
    heartCtx.font = '11px sans-serif';
    heartCtx.fillText(trackActual.artist || 'Desconocido', centroX, H - 10);
    
    heartCtx.restore();
  }
}

// Inicializar ciclo de animación
animarMonitorSignosVitales();

// Inyección limpia del analizador dentro del método de reproducción original
const funcionPlayOriginal = play;
play = function() {
  funcionPlayOriginal();
  engancharMonitorCardiaco();
};
