/* ============================================
   PARCHATE™ — app.js (Buscador de Radio en Vivo + Favoritos)
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
  repeat: false,
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

// API de Radio Browser — CORS abierto, sin key, estaciones de radio en vivo
const RADIO_API = 'https://de1.api.radio-browser.info/json';

// Audio alternativo para streams de radio (sin Web Audio API)
let radioAudio = null;

// ============================================
// SISTEMA DE FAVORITOS (localStorage)
// ============================================
function getFavoritas() {
  try {
    return JSON.parse(localStorage.getItem('parchate_favoritas') || '[]');
  } catch(e) {
    return [];
  }
}

function guardarFavorita(station) {
  const favoritas = getFavoritas();
  const url = station.url_resolved || station.url;
  if (!favoritas.find(f => f.url === url)) {
    favoritas.push({
      name: station.name,
      url: url,
      genre: station.tags || station.country || '',
      favicon: station.favicon || '',
      codec: station.codec || 'MP3',
      bitrate: station.bitrate || 0
    });
    localStorage.setItem('parchate_favoritas', JSON.stringify(favoritas));
    return true;
  }
  return false;
}

function eliminarFavorita(url) {
  const favoritas = getFavoritas().filter(f => f.url !== url);
  localStorage.setItem('parchate_favoritas', JSON.stringify(favoritas));
  return favoritas;
}

function esFavorita(url) {
  return getFavoritas().some(f => f.url === url);
}

// ============================================
// WEB AUDIO API — cadena de nodos
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

const ytSearchInput  = document.getElementById('ytSearchInput');
const ytSearchBtn    = document.getElementById('ytSearchBtn');
const ytResults      = document.getElementById('ytResults');
const ytFavorites    = document.getElementById('ytFavorites');

// ============================================
// RENDER
// ============================================
function render() {
  iconPlay.style.display  = state.isPlaying ? 'none' : 'block';
  iconPause.style.display = state.isPlaying ? 'block' : 'none';

  shuffleBtn.classList.toggle('active', state.shuffle);
  repeatBtn.classList.toggle('active', state.repeatMode !== 'none');

  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  progressFill.style.width = pct.toFixed(2) + '%';
  timeCurrentEl.textContent = state.isPlaying && state.duration === 0 ? '📻 En vivo' : formatTime(state.currentTime);
  timeTotalEl.textContent   = state.duration > 0 ? formatTime(state.duration) : '∞';

  volumeSlider.value = state.volume;

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
    actualizarPantallaDeBloqueo(t);
  } else {
    songTitle.textContent  = 'Selecciona una canción';
    songArtist.textContent = '—';
    coverBadge.textContent = '0 / ' + state.tracks.length;
    coverImg.style.display = 'none';
    coverDefault.style.display = 'flex';
  }

  gainLabel.textContent  = state.gain.toFixed(1) + 'x';
  gainSlider.value       = state.gain;
  bassLabel.textContent  = fmtDb(state.eq.bass);
  midLabel.textContent   = fmtDb(state.eq.mid);
  trebleLabel.textContent = fmtDb(state.eq.treble);
  bassSlider.value       = state.eq.bass;
  midSlider.value        = state.eq.mid;
  trebleSlider.value     = state.eq.treble;

  renderTracklist();

  document.documentElement.style.setProperty('--ac', state.theme.accent);
  document.documentElement.setAttribute('data-theme', state.theme.darkMode ? 'dark' : 'light');

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
      '<span class="track-duration">' + (track.duration > 0 ? formatTime(track.duration) : '📻 En vivo') + '</span>';
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
      if (loaded === fileArr.length) render();
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

  if (state.currentIndex < 0 && fileArr.length > 0) loadTrack(0, false);
  render();
}

// ============================================
// MOSTRAR FAVORITAS
// ============================================
function mostrarFavoritas() {
  const favoritas = getFavoritas();
  if (!ytFavorites) return;

  if (favoritas.length === 0) {
    ytFavorites.innerHTML = `
      <div style="text-align:center;padding:1rem;color:var(--txt-3);font-size:12px;margin-bottom:16px">
        ⭐ No tienes emisoras favoritas aún<br>
        <small>Busca una estación y haz clic en ☆ para guardarla</small>
      </div>`;
    return;
  }

  ytFavorites.innerHTML = `
    <div style="font-size:13px;font-weight:bold;color:var(--txt-2);margin-bottom:8px;padding:0 4px">
      ⭐ Mis Emisoras Favoritas
    </div>
    ${favoritas.map((fav, i) => `
      <div class="yt-result-card fav-card" style="position:relative;cursor:pointer;margin-bottom:8px" data-index="${i}">
        <div class="yt-card-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--ac);font-size:24px;min-height:60px;overflow:hidden">
          ${fav.favicon ? `<img src="${fav.favicon}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='📻'">` : '📻'}
        </div>
        <div class="yt-card-info">
          <div class="yt-card-title">${escHtml(fav.name)}</div>
          <div class="yt-card-author">${escHtml(fav.genre)} · ${fav.codec} ${fav.bitrate > 0 ? fav.bitrate + 'kbps' : ''}</div>
        </div>
        <button class="fav-remove-btn" style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,0.6);border:none;color:gold;font-size:16px;padding:2px 6px;border-radius:50%;cursor:pointer;z-index:2">⭐</button>
      </div>
    `).join('')}
  `;

  // Eventos para cada favorita
  ytFavorites.querySelectorAll('.fav-card').forEach((card) => {
    const i = parseInt(card.dataset.index);
    card.addEventListener('click', () => {
      const fav = favoritas[i];
      const nuevoTrack = {
        url: fav.url,
        title: fav.name,
        artist: fav.genre,
        duration: 0,
        cover: fav.favicon
      };
      state.tracks.push(nuevoTrack);
      loadTrack(state.tracks.length - 1, true);
    });

    // Eliminar favorita
    card.querySelector('.fav-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarFavorita(favoritas[i].url);
      mostrarFavoritas();
      // Actualizar estrellas en resultados si hay
      if (ytResults.children.length > 0 && !ytResults.querySelector('.fav-btn')) {
        // Solo recargar favoritas
      }
    });
  });
}

// ============================================
// BUSCADOR DE RADIO EN VIVO — RADIO BROWSER API
// ============================================
async function buscarMusicaOnline() {
  const query = ytSearchInput.value.trim();
  if (!query) return;

  ytResults.innerHTML = `
    <div style="text-align:center;padding:2rem;color:var(--txt-3);font-size:14px">
      📻 Buscando estaciones de radio...
    </div>`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const apiUrl = `${RADIO_API}/stations/search?name=${encodeURIComponent(query)}&limit=10&hidebroken=true&order=clickcount&reverse=true`;
    
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);

    const stations = await res.json();

    if (!stations || stations.length === 0) {
      ytResults.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--txt-3)">
          📻 No se encontraron estaciones para "${escHtml(query)}"
          <br><small style="display:block;margin-top:0.8rem;color:var(--txt-3)">Prueba con: rock, jazz, pop, cumbia, vallenato, salsa, reggae, classical, electronic, hip hop</small>
        </div>`;
      return;
    }

    ytResults.innerHTML = '';

    stations.forEach(station => {
      const rawUrl = station.url_resolved || station.url;
      if (!rawUrl) return;

      const streamUrl = rawUrl;
      const name = station.name || 'Sin nombre';
      const genre = station.tags || station.country || 'Desconocido';
      const bitrate = station.bitrate || 0;
      const listeners = station.clickcount || 0;
      const favicon = station.favicon || '';
      const codec = station.codec || 'MP3';
      const isFav = esFavorita(streamUrl);

      const card = document.createElement('div');
      card.className = 'yt-result-card';
      card.style.position = 'relative';

      card.innerHTML = `
        <div class="yt-card-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--ac);font-size:32px;min-height:90px;overflow:hidden">
          ${favicon ? `<img src="${favicon}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='📻'">` : '📻'}
        </div>
        <div class="yt-card-info">
          <div class="yt-card-title">${escHtml(name)}</div>
          <div class="yt-card-author">${escHtml(genre)} · ${codec} ${bitrate > 0 ? bitrate + 'kbps' : ''}</div>
          <div class="yt-card-duration">🎧 ${listeners.toLocaleString()} oyentes</div>
        </div>
        <button class="yt-card-add-btn">▶ Sintonizar</button>
        <button class="fav-btn" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.5);border:none;color:${isFav ? 'gold' : 'white'};font-size:18px;padding:4px 8px;border-radius:50%;cursor:pointer;z-index:2">${isFav ? '⭐' : '☆'}</button>
      `;

      // Evento para sintonizar
      const agregarALista = () => {
        const nuevoTrack = {
          url: streamUrl,
          title: name,
          artist: genre,
          duration: 0,
          cover: favicon
        };

        state.tracks.push(nuevoTrack);
        loadTrack(state.tracks.length - 1, true);

        card.querySelectorAll('.yt-card-add-btn').forEach(btn => {
          btn.textContent = '📻 Sonando';
          btn.style.background = 'var(--ac)';
          btn.style.color = 'white';
        });
      };

      card.querySelector('.yt-card-add-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        agregarALista();
      });

      card.addEventListener('click', agregarALista);

      // Evento para favorito
      const favBtn = card.querySelector('.fav-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (esFavorita(streamUrl)) {
          eliminarFavorita(streamUrl);
          favBtn.textContent = '☆';
          favBtn.style.color = 'white';
        } else {
          guardarFavorita(station);
          favBtn.textContent = '⭐';
          favBtn.style.color = 'gold';
        }
        mostrarFavoritas();
      });

      ytResults.appendChild(card);
    });

    if (ytResults.children.length === 0) {
      ytResults.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--txt-3)">
          📻 No se encontraron estaciones con stream disponible
        </div>`;
    }

  } catch (error) {
    console.error('Error en búsqueda:', error);

    if (error.name === 'AbortError') {
      ytResults.innerHTML = `
        <div style="text-align:center;padding:2rem;color:#fbbf24">
          ⏱️ La búsqueda tardó demasiado
          <button onclick="buscarMusicaOnline()" 
                  style="display:block;margin:1rem auto 0;padding:0.5rem 1.5rem;background:var(--ac);color:white;border:none;border-radius:8px;cursor:pointer">
            🔄 Reintentar
          </button>
        </div>`;
    } else {
      ytResults.innerHTML = `
        <div style="text-align:center;padding:2rem;color:#f87171">
          <strong>😔 No se pudo buscar</strong>
          <small style="color:var(--txt-3);display:block;margin-top:0.5rem">
            ${escHtml(error.message)}
          </small>
          <button onclick="buscarMusicaOnline()" 
                  style="display:block;margin:1rem auto 0;padding:0.5rem 1.5rem;background:var(--ac);color:white;border:none;border-radius:8px;cursor:pointer">
            🔄 Reintentar
          </button>
        </div>`;
    }
  }
}

ytSearchBtn.addEventListener('click', buscarMusicaOnline);
ytSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buscarMusicaOnline();
});

// ============================================
// MEDIASESSION API
// ============================================
function actualizarPantallaDeBloqueo(track) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || 'Parchate™',
      album: track.duration > 0 ? 'Parchate™' : 'Radio en vivo 📻',
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
// REPRODUCCIÓN (CORREGIDA PARA RADIO)
// ============================================
function loadTrack(index, autoPlay) {
  if (index < 0 || index >= state.tracks.length) return;
  state.currentIndex = index;
  const track = state.tracks[index];
  
  console.log('🎵 Cargando:', track.title);
  console.log('🔗 URL:', track.url);
  
  if (radioAudio) {
    radioAudio.pause();
    radioAudio = null;
  }
  
  if (track.duration === 0) {
    radioAudio = new Audio();
    radioAudio.src = track.url;
    radioAudio.volume = state.volume;
    radioAudio.crossOrigin = 'anonymous';
  } else {
    audioEl.src = track.url;
    audioEl.volume = state.volume;
  }
  
  state.isPlaying = false;
  state.currentTime = 0;
  state.duration = track.duration || 0;
  render();
  if (autoPlay) play();
}

function play() {
  if (radioAudio && state.duration === 0) {
    radioAudio.volume = state.volume;
    radioAudio.play().then(() => {
      state.isPlaying = true;
      console.log('✅ Radio sonando');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
      render();
    }).catch((err) => {
      console.error('❌ Error radio:', err.message);
    });
    return;
  }
  
  if (!audioEl.src) return;
  initAudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  audioEl.play().then(() => {
    state.isPlaying = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
    render();
  }).catch((err) => {
    console.error('❌ Error al reproducir:', err.message);
  });
}

function pause() {
  if (radioAudio) radioAudio.pause();
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
    if (radioAudio) radioAudio.currentTime = 0;
    else audioEl.currentTime = 0;
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
  if (radioAudio) radioAudio.volume = state.volume;
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
  if (state.duration > 0) {
    const pct = (state.currentTime / state.duration) * 100;
    progressFill.style.width = pct.toFixed(2) + '%';
    timeCurrentEl.textContent = formatTime(state.currentTime);
  } else {
    progressFill.style.width = '100%';
    timeCurrentEl.textContent = '📻 En vivo';
  }
});

audioEl.addEventListener('loadedmetadata', () => {
  state.duration = audioEl.duration;
  if (isNaN(state.duration) || !isFinite(state.duration)) state.duration = 0;
  timeTotalEl.textContent = state.duration > 0 ? formatTime(state.duration) : '∞';
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
// TABS
// ============================================
const elementosNavegacion = document.querySelectorAll('.tab, #configBtn, [data-tab="config"]');

elementosNavegacion.forEach(tab => {
  tab.addEventListener('click', () => {
    elementosNavegacion.forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });
    tab.classList.add('active');
    const destino = tab.dataset.tab;
    const panelDestino = document.getElementById('tab-' + destino) || document.getElementById(destino);
    if (panelDestino) {
      panelDestino.classList.add('active');
      panelDestino.style.display = 'block';
      if (destino === 'player') setTimeout(redimensionarMonitor, 50);
    }
  });
});

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
mostrarFavoritas();

document.querySelectorAll('.swatch').forEach(sw => {
  sw.classList.toggle('active', sw.dataset.color === state.theme.accent);
});

console.log('%cParchate™ listo — Radio Browser + Favoritos ⭐📻', 'color:' + state.theme.accent + ';font-size:16px;font-weight:bold');

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
    x: x, y: y,
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
  if (W === 0 && heartCanvas.offsetWidth > 0) { redimensionarMonitor(); return; }
  
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
    n.x += n.vx; n.y += n.vy; n.opacidad -= 0.015;
    if (n.opacidad <= 0) { notasMusicalesArray.splice(i, 1); continue; }
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
    heartCtx.drawImage(calaveraRealista, centroX - anchoCalavera / 2, centroY - altoCalavera / 2 - 10, anchoCalavera, altoCalavera);
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

animarMonitorSignosVitales();

const funcionPlayOriginal = play;
play = function() {
  funcionPlayOriginal();
  engancharMonitorCardiaco();
};
