(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const audio = $('audioPlayer');
  const state = {
    songs: [], genre: 'Todas', screen: 'catalog', song: null, lyrics: [], melody: [],
    duration: 0, playing: false, elapsed: 0, demoStart: 0, demoContext: null,
    demoGain: null, demoVoices: [], nextDemoBeat: 0,
    micStream: null, micContext: null, analyser: null, sampleBuffer: null,
    pitch: null, lastPitch: 0, lastFrame: 0, lastEvaluation: 0,
    earned: 0, elapsedNotes: 0, heard: 0, noteCount: 0,
    combo: 0, bestCombo: 0, previousNote: -1, noteQuality: 0, noteTime: 0,
    everHeard: false, done: false, currentScore: 0, scoreAvailable: false,
    tempUrls: [], loading: false
  };
  const DB_KEY = 'vale-karaoke-ranking-v1';
  const NAME_KEY = 'vale-karaoke-singer';
  const DEMO_ID = 'demo-original';
  let toastTimer = null;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const isNumber = (n) => Number.isFinite(Number(n));
  const formatTime = (s) => {
    const sec = Math.floor(Math.max(0, s || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  const formatPoints = (n) => Math.round(n).toLocaleString('pt-BR');
  const readRanking = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(x => x && isNumber(x.score) && x.songId && x.name) : [];
    } catch { return []; }
  };
  const saveRanking = (entries) => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(entries.slice(0, 500))); return true; }
    catch { toast('Sem espaço para salvar o ranking neste navegador.'); return false; }
  };
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3900);
  }
  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function normalizeMelody(raw) {
    const source = Array.isArray(raw) ? raw : (raw && raw.notes);
    if (!Array.isArray(source)) return [];
    const offset = Number(raw && raw.offsetMs) / 1000 || 0;
    return source
      .filter(x => x && isNumber(x.start) && isNumber(x.end) && isNumber(x.midi))
      .map(x => ({start: Number(x.start) + offset, end: Number(x.end) + offset, midi: Number(x.midi)}))
      .filter(x => x.start >= 0 && x.end > x.start && x.end - x.start < 60 && x.midi >= 24 && x.midi <= 108)
      .sort((a, b) => a.start - b.start);
  }
  function parseLrc(text) {
    const lines = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const pattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
      let m;
      const clean = line.replace(pattern, '').trim();
      while ((m = pattern.exec(line))) {
        const frac = (m[3] || '0').padEnd(3, '0');
        lines.push({time: Number(m[1]) * 60 + Number(m[2]) + Number(frac) / 1000, text: clean});
      }
    }
    return lines.sort((a, b) => a.time - b.time);
  }
  const demoSong = {
    id: DEMO_ID, title: 'A Luz do Meu Palco', artist: 'VALE KARAOKE · Demo original',
    genre: 'Demo', demo: true, duration: 32, tint: 'purple',
    lyrics: 'songs/demo/lyrics.lrc', melody: 'songs/demo/melody.json',
    description: 'Instrumental original criado no navegador. Cante usando fones!'
  };
  async function loadCatalog() {
    try {
      const response = await fetch('songs/catalog.json', {cache: 'no-store'});
      if (!response.ok) throw new Error('Catálogo indisponível');
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error('O catálogo precisa ser uma lista JSON');
      state.songs = items.filter(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.artist === 'string');
    } catch (error) {
      console.error(error);
      state.songs = [demoSong];
      toast('Não foi possível carregar o catálogo. Abra pelo GitHub Pages ou servidor local.');
    }
    if (!state.songs.some(s => s.id === DEMO_ID)) state.songs.unshift(demoSong);
    renderCatalog();
    refreshRanking();
    updateHeroStats();
  }
  function renderChips() {
    const genres = ['Todas', ...new Set(state.songs.map(s => s.genre || 'Outras'))];
    const root = $('genreChips');
    root.replaceChildren();
    for (const genre of genres) {
      const btn = node('button', 'chip' + (genre === state.genre ? ' active' : ''), genre);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(genre === state.genre));
      btn.addEventListener('click', () => {state.genre = genre; renderCatalog();});
      root.append(btn);
    }
  }
  function coverElement(song) {
    const cover = node('div', 'card-cover');
    cover.dataset.tint = song.tint || 'purple';
    if (song.cover) {
      const img = node('img');
      img.src = song.cover;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => {img.remove(); cover.prepend(node('span', 'cover-note', '♫'));};
      cover.append(img);
    } else cover.append(node('span', 'cover-note', song.demo ? '♪' : '♫'));
    cover.append(node('span', 'card-badge', song.demo ? 'DEMONSTRAÇÃO' : 'KARAOKÊ'));
    const play = node('button', 'card-play', '▶');
    play.type = 'button';
    play.setAttribute('aria-label', 'Cantar ' + song.title);
    play.addEventListener('click', () => openSong(song));
    cover.append(play);
    return cover;
  }
  function renderCatalog() {
    renderChips();
    const root = $('songGrid');
    root.replaceChildren();
    const term = $('searchInput').value.trim().toLocaleLowerCase('pt-BR');
    const songs = state.songs.filter(s =>
      (state.genre === 'Todas' || (s.genre || 'Outras') === state.genre) &&
      (!term || (s.title + ' ' + s.artist + ' ' + (s.genre || '')).toLocaleLowerCase('pt-BR').includes(term)));
    for (const song of songs) {
      const card = node('article', 'song-card');
      card.append(coverElement(song));
      const info = node('div', 'card-info');
      info.append(node('h3', '', song.title), node('p', '', song.artist));
      const foot = node('div', 'card-foot');
      foot.append(node('span', '', song.genre || 'Outras'));
      foot.append(node('b', '', song.melody ? '★ COM PONTUAÇÃO' : 'MODO LIVRE'));
      info.append(foot);
      card.append(info);
      card.addEventListener('dblclick', () => openSong(song));
      root.append(card);
    }
    $('emptyCatalog').hidden = songs.length !== 0;
    $('songCount').textContent = String(state.songs.length);
  }
  function updateHeroStats() {
    const ranks = readRanking();
    const best = ranks.length ? Math.max(...ranks.map(x => Number(x.score))) : 0;
    $('recordValue').textContent = best ? formatPoints(best) : '—';
  }
  function showSection(which) {
    state.screen = which;
    const ranking = which === 'ranking';
    $('catalogSection').hidden = ranking;
    $('rankingSection').hidden = !ranking;
    $('hero').hidden = ranking;
    document.querySelector('.statsline').hidden = ranking;
    document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === which));
    if (ranking) refreshRanking();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  function refreshRanking() {
    const select = $('rankingSong');
    const selected = select.value;
    select.replaceChildren(new Option('Todas', 'all'));
    for (const song of state.songs) select.add(new Option(song.title, song.id));
    select.value = Array.from(select.options).some(opt => opt.value === selected) ? selected : 'all';
    const records = readRanking().filter(x => select.value === 'all' || x.songId === select.value).sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 50);
    const root = $('rankList');
    root.replaceChildren();
    if (!records.length) {
      root.append(node('div', 'empty', 'O palco está esperando a primeira estrela. Cante uma música e salve seus pontos!'));
      return;
    }
    records.forEach((record, i) => {
      const row = node('article', 'rank-row');
      row.append(node('span', 'rank-position' + (i < 3 ? ' gold' : ''), String(i + 1).padStart(2, '0')));
      const middle = node('div');
      middle.append(node('b', '', record.name));
      const date = new Date(record.createdAt);
      const dateText = Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : '';
      middle.append(node('small', '', record.songTitle + ' · ' + dateText + ' · ' + (record.grade || '—')));
      row.append(middle);
      const points = node('div', 'rank-points', formatPoints(record.score));
      points.append(node('small', '', ' PTS'));
      row.append(points); root.append(row);
    });
  }
  async function fetchSongData(song) {
    const lrcText = typeof song.inlineLyrics === 'string' ? song.inlineLyrics :
      song.lyrics ? await (await checkedFetch(song.lyrics)).text() : '';
    const melodyData = song.inlineMelody || (song.melody ? await (await checkedFetch(song.melody)).json() : null);
    const parsed = parseLrc(lrcText);
    const notes = normalizeMelody(melodyData);
    if (!song.demo && !song.audio) throw new Error('A música não tem arquivo de áudio.');
    return {parsed, notes};
  }
  async function checkedFetch(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('Não foi possível carregar: ' + path);
    return r;
  }
  function resetScore() {
    state.earned = 0; state.elapsedNotes = 0; state.heard = 0; state.noteCount = 0;
    state.combo = 0; state.bestCombo = 0; state.previousNote = -1;
    state.noteQuality = 0; state.noteTime = 0; state.everHeard = false;
    state.lastEvaluation = 0; state.currentScore = 0; state.done = false;
    $('liveScore').textContent = '0'; $('accuracyValue').textContent = '—';
    $('comboValue').textContent = '0×'; $('liveGrade').textContent = 'PREPARE-SE';
    $('scoreRing').style.setProperty('--p', '0');
  }
  function clearDemoVoices() {
    for (const osc of state.demoVoices) {
      try {osc.stop();} catch {}
    }
    state.demoVoices = [];
  }
  function stopPlayback() {
    state.playing = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    clearDemoVoices();
  }
  async function openSong(song) {
    if (state.loading) return;
    state.loading = true;
    try {
      const data = await fetchSongData(song);
      stopPlayback();
      state.song = song; state.lyrics = data.parsed; state.melody = data.notes;
      state.scoreAvailable = data.notes.length > 0;
      state.duration = Number(song.duration) || 0;
      state.elapsed = 0; state.demoStart = 0;
      state.pitch = null; state.lastFrame = 0;
      resetScore(); 
      if (!song.demo) {
        audio.src = song.audio;
        audio.volume = Number($('playerVolume').value) / 100;
        audio.load();
        if (Number.isFinite(audio.duration) && audio.duration > 0) state.duration = audio.duration;
      } else await setupDemo();
      $('stageTitle').textContent = song.title;
      $('stageArtist').textContent = song.artist;
      $('stageCover').replaceChildren();
      if (song.cover) {
        const img = node('img'); img.src = song.cover; img.alt = '';
        img.onerror = () => $('stageCover').replaceChildren(node('span', '', '♫'));
        $('stageCover').append(img);
      } else $('stageCover').textContent = '♫';
      $('modeLabel').textContent = state.scoreAvailable ? 'AFINAÇÃO' : 'MODO LIVRE';
      $('modeLabel').title = state.scoreAvailable ? 'Pontuação baseada em notas cadastradas' : 'Não há melodia de referência nesta faixa';
      $('pitchCaption').textContent = state.scoreAvailable ? 'Ative o microfone para acompanhar sua voz' : 'Sem melodia cadastrada — pontuação desativada';
      $('pitchIndicator').style.opacity = '0';
      $('playerScreen').hidden = false; $('resultModal').hidden = true;
      document.body.style.overflow = 'hidden';
      $('playPause').textContent = '▶';
      renderFrame(true);
      $('playPause').focus({preventScroll: true});
      if (!state.scoreAvailable) toast('Modo livre: adicione melodia.json para ativar a avaliação vocal.');
      else toast('Pronto para cantar! Ative o microfone e aperte ▶.');
    } catch (error) {
      console.error(error); toast(error.message || 'Não foi possível abrir a música.');
    } finally {state.loading = false;}
  }
  async function setupDemo() {
    if (!state.demoContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Este navegador não oferece Web Audio.');
      state.demoContext = new AudioCtx();
      state.demoGain = state.demoContext.createGain();
      state.demoGain.connect(state.demoContext.destination);
    }
    state.demoGain.gain.value = Number($('playerVolume').value) / 100 * 0.65;
    state.nextDemoBeat = 0;
  }
  function scheduleDemoSound(frequency, time, duration, volume, type) {
    const ctx = state.demoContext;
    if (!ctx || !state.demoGain) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain); gain.connect(state.demoGain);
    osc.start(time); osc.stop(time + duration + 0.025);
    state.demoVoices.push(osc);
    osc.onended = () => {state.demoVoices = state.demoVoices.filter(v => v !== osc); try {osc.disconnect(); gain.disconnect();} catch {}};
  }
  function scheduleDemo(t) {
    if (!state.playing || !state.song || !state.song.demo || !state.demoContext) return;
    const ctx = state.demoContext;
    const chords = [[48,52,55],[53,57,60],[55,59,62],[57,60,64]];
    while (state.nextDemoBeat * .5 < Math.min(t + .27, state.duration)) {
      const beat = state.nextDemoBeat++;
      const beatTime = beat * .5;
      if (beatTime < t - .17) continue;
      const when = ctx.currentTime + Math.max(.015, beatTime - t + .03);
      const bar = Math.floor(beat / 8) % 4;
      if (beat % 8 === 0) {
        for (const note of chords[bar]) scheduleDemoSound(440 * Math.pow(2, (note - 69) / 12), when, 2.5, .043, 'triangle');
      }
      if (beat % 2 === 0) scheduleDemoSound(85, when, .14, .11, 'sine');
      if (beat % 2 === 1) scheduleDemoSound(330, when, .075, .017, 'triangle');
      if (beat % 4 === 2) scheduleDemoSound(210, when, .15, .028, 'triangle');
    }
  }
  function getTime() {
    if (!state.song) return 0;
    if (!state.song.demo) return audio.currentTime || 0;
    return state.playing ? Math.min(state.duration, (performance.now() - state.demoStart) / 1000) : state.elapsed;
  }
  async function startPlayback() {
    if (!state.song || state.playing) return;
    try {
      if (state.song.demo) {
        await state.demoContext.resume();
        state.demoStart = performance.now() - state.elapsed * 1000;
        state.nextDemoBeat = Math.floor(state.elapsed / .5);
      } else {
        await audio.play();
      }
      state.playing = true;
      state.lastEvaluation = getTime();
      state.lastFrame = 0;
      $('playPause').textContent = 'Ⅱ';
      requestAnimationFrame(renderFrame);
    } catch (error) {
      console.error(error);
      toast('Não foi possível reproduzir. Verifique o arquivo, o formato e a permissão de áudio.');
    }
  }
  function pausePlayback() {
    if (!state.playing) return;
    state.elapsed = getTime();
    state.playing = false;
    if (state.song && state.song.demo) clearDemoVoices();
    else audio.pause();
    $('playPause').textContent = '▶';
  }
  function replaySong() {
    if (!state.song) return;
    pausePlayback();
    state.elapsed = 0;
    if (state.song.demo) state.nextDemoBeat = 0;
    else audio.currentTime = 0;
    resetScore();
    $('resultModal').hidden = true;
    renderFrame(true);
    startPlayback();
  }
  function seekSong(value) {
    if (!state.song || !state.duration) return;
    const wasPlaying = state.playing;
    pausePlayback();
    state.elapsed = clamp(value, 0, 1) * state.duration;
    if (!state.song.demo) audio.currentTime = state.elapsed;
    else state.nextDemoBeat = Math.floor(state.elapsed / .5);
    resetScore();
    renderFrame(true);
    if (wasPlaying) startPlayback();
    toast('Pontuação zerada ao mudar a posição da música.');
  }
  function midiToName(midi) {
    if (!isNumber(midi)) return '—';
    const names = ['Dó','Dó♯','Ré','Ré♯','Mi','Fá','Fá♯','Sol','Sol♯','Lá','Lá♯','Si'];
    return names[((Math.round(midi) % 12) + 12) % 12] + String(Math.floor(Math.round(midi) / 12) - 1);
  }
  function pitchFromBuffer(buffer, rate) {
    const size = buffer.length;
    let power = 0;
    for (let i = 0; i < size; i++) power += buffer[i] * buffer[i];
    const rms = Math.sqrt(power / size);
    if (rms < .014) return {rms, frequency: null, midi: null};
    const minLag = Math.floor(rate / 1000);
    const maxLag = Math.min(Math.floor(rate / 85), Math.floor(size / 2));
    let accumulated = 0, bestLag = -1, bestValue = Infinity, previous = 1;
    const limit = Math.min(2000, size - maxLag);
    for (let lag = 1; lag <= maxLag; lag++) {
      let d = 0;
      for (let i = 0; i < limit; i += 2) {
        const delta = buffer[i] - buffer[i + lag];
        d += delta * delta;
      }
      accumulated += d;
      const value = accumulated ? (d * lag / accumulated) : 1;
      if (lag >= minLag && value < bestValue) { bestValue = value; bestLag = lag; }
      if (lag > minLag && value > previous && previous < .15 && bestLag >= minLag) break;
      previous = value;
    }
    if (bestLag < 0 || bestValue > .30) return {rms, frequency: null, midi: null};
    const frequency = rate / bestLag;
    return {rms, frequency, midi: 69 + 12 * Math.log2(frequency / 440)};
  }
  async function toggleMic() {
    if (state.micStream) {stopMic(); return;}
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Microfone indisponível. Abra o site por HTTPS em um navegador atualizado.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false}, video: false
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);
      state.micStream = stream; state.micContext = ctx; state.analyser = analyser;
      state.sampleBuffer = new Float32Array(analyser.fftSize);
      $('micButton').textContent = 'Desligar microfone';
      $('micStatus').textContent = 'Microfone ativo';
      $('micHelp').textContent = 'Acompanhando sua voz';
      $('micPulse').classList.add('on');
      toast('Microfone pronto. Sua voz é processada somente neste navegador.');
    } catch (error) {
      console.error(error);
      toast('Acesso ao microfone não autorizado ou indisponível. Confira as permissões do navegador.');
    }
  }
  function stopMic() {
    if (state.micStream) state.micStream.getTracks().forEach(track => track.stop());
    if (state.micContext) state.micContext.close().catch(() => {});
    state.micStream = null; state.micContext = null; state.analyser = null; state.sampleBuffer = null;
    state.pitch = null;
    $('micButton').textContent = '🎤 Ativar microfone';
    $('micStatus').textContent = 'Microfone desligado';
    $('micHelp').textContent = 'Ative para pontuar';
    $('micPulse').classList.remove('on');
    $('volumeFill').style.width = '0%';
    $('detectedNote').textContent = '—';
    $('pitchIndicator').style.opacity = '0';
  }
  function findNoteIndex(t) {
    for (let i = 0; i < state.melody.length; i++) {
      const note = state.melody[i];
      if (t >= note.start && t < note.end) return i;
      if (note.start > t) break;
    }
    return -1;
  }
  function pitchQuality(actual, expected) {
    if (!isNumber(actual)) return 0;
    let semitoneDiff = Math.abs(actual - expected);
    if ($('octaveFree').checked) semitoneDiff = Math.abs(((actual - expected + 6) % 12 + 12) % 12 - 6);
    if (semitoneDiff <= .32) return 1;
    if (semitoneDiff >= 1.55) return 0;
    return Math.pow(1 - (semitoneDiff - .32) / 1.23, 1.3);
  }
  function finishNote() {
    if (state.previousNote < 0) return;
    const mean = state.noteTime ? state.noteQuality / state.noteTime : 0;
    if (mean >= .62) {state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);}
    else state.combo = 0;
    state.previousNote = -1; state.noteQuality = 0; state.noteTime = 0;
  }
  function evaluate(t) {
    if (!state.playing || !state.scoreAvailable) return;
    const index = findNoteIndex(t);
    if (index !== state.previousNote) {
      finishNote();
      state.previousNote = index;
    }
    const dt = clamp(t - state.lastEvaluation, 0, .16);
    state.lastEvaluation = t;
    if (index === -1 || dt <= 0) return;
    const target = state.melody[index];
    const score = state.micStream && state.pitch && state.pitch.midi !== null ?
      pitchQuality(state.pitch.midi, target.midi) : 0;
    state.earned += score * dt;
    state.elapsedNotes += dt;
    if (state.micStream && state.pitch && state.pitch.midi !== null) {
      state.heard += dt; state.everHeard = true;
    }
    state.noteQuality += score * dt;
    state.noteTime += dt;
    const fullDuration = state.melody.reduce((acc, n) => acc + n.end - n.start, 0);
    state.currentScore = clamp(Math.round(10000 * state.earned / Math.max(.01, fullDuration)), 0, 10000);
  }
  function renderLyrics(t) {
    const lines = state.lyrics;
    let at = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= t + .04) at = i;
      else break;
    }
    $('previousLyric').textContent = at > 0 ? lines[at - 1].text : '';
    $('activeLyric').textContent = at >= 0 && lines[at].text ? lines[at].text : (at === -1 ? 'Prepare sua voz!' : '♪  ♫  ♪');
    $('nextLyric').textContent = at + 1 < lines.length ? lines[at + 1].text : '';
  }
  function renderFrame(force) {
    if (!state.song) return;
    const now = performance.now();
    const t = getTime();
    if (state.playing && (force === true || now - state.lastPitch > 90)) {
      state.lastPitch = now;
      if (state.analyser && state.micContext) {
        state.analyser.getFloatTimeDomainData(state.sampleBuffer);
        state.pitch = pitchFromBuffer(state.sampleBuffer, state.micContext.sampleRate);
        $('volumeFill').style.width = clamp((state.pitch.rms || 0) * 550, 0, 100) + '%';
        $('detectedNote').textContent = state.pitch.midi === null ? '—' : midiToName(state.pitch.midi);
      } else state.pitch = null;
    }
    if (state.playing) {
      evaluate(t);
      if (state.song.demo) scheduleDemo(t);
    }
    $('currentTime').textContent = formatTime(t);
    $('durationTime').textContent = formatTime(state.duration);
    if (state.duration) $('seekBar').value = String(Math.round(clamp(t / state.duration, 0, 1) * 1000));
    renderLyrics(t);
    const index = findNoteIndex(t);
    const reference = index !== -1 ? state.melody[index] : null;
    $('targetNote').textContent = reference ? midiToName(reference.midi) : '—';
    $('pitchIndicator').style.opacity = state.pitch && state.pitch.midi !== null && reference ? '1' : '0';
    if (state.pitch && state.pitch.midi !== null && reference) {
      let diff = state.pitch.midi - reference.midi;
      if ($('octaveFree').checked) diff = ((diff + 6) % 12 + 12) % 12 - 6;
      $('pitchIndicator').style.left = 'calc(' + clamp(50 + diff * 15, 5, 95) + '% - 9px)';
      const quality = pitchQuality(state.pitch.midi, reference.midi);
      $('pitchCaption').textContent = quality > .8 ? '★ Excelente afinação!' : quality > .4 ? 'Quase lá — ajuste um pouco a nota' : 'Ajuste a altura da sua voz para a nota indicada';
    } else if (state.scoreAvailable) {
      $('pitchCaption').textContent = state.micStream ? (reference ? 'Cante a nota indicada' : 'Trecho instrumental') : 'Ative o microfone para acompanhar sua voz';
    }
    $('liveScore').textContent = formatPoints(state.currentScore);
    $('scoreRing').style.setProperty('--p', String(state.currentScore / 100));
    $('accuracyValue').textContent = state.elapsedNotes ? Math.round(100 * state.earned / state.elapsedNotes) + '%' : '—';
    $('comboValue').textContent = state.combo + '×';
    $('liveGrade').textContent = state.scoreAvailable ? (state.everHeard ? gradeFor(state.currentScore).label : 'PREPARE-SE') : 'MODO LIVRE';
    if (state.playing && state.duration && t >= state.duration - .045 && !state.done) finishSong();
    else if (state.playing) requestAnimationFrame(renderFrame);
  }
  function gradeFor(score) {
    if (score >= 9000) return {grade: 'S', label: 'LENDÁRIO'};
    if (score >= 7500) return {grade: 'A', label: 'EXCELENTE'};
    if (score >= 6000) return {grade: 'B', label: 'MUITO BOM'};
    if (score >= 4000) return {grade: 'C', label: 'BOM TRABALHO'};
    return {grade: 'D', label: 'CONTINUE TREINANDO'};
  }
  function finishSong() {
    if (state.done) return;
    finishNote();
    state.done = true;
    pausePlayback();
    const recordable = state.scoreAvailable && state.heard >= 1;
    const grade = gradeFor(state.currentScore);
    $('resultStars').textContent = recordable ? ('★ '.repeat(Math.max(1, Math.round(state.currentScore / 2000))).trim()) : '♫  ♪  ♫';
    $('resultTitle').textContent = recordable ? grade.label : 'Obrigado pelo show!';
    $('finalGrade').textContent = recordable ? grade.grade : '♪';
    $('finalScore').replaceChildren();
    $('finalScore').append(document.createTextNode(recordable ? formatPoints(state.currentScore) : 'Modo livre'));
    $('finalScore').append(node('small', '', recordable ? ' / 10.000 PTS' : ''));
    $('resultDescription').textContent = recordable ?
      'Melhor combo: ' + state.bestCombo + '×. A avaliação é aproximada e depende da afinação e da captação do microfone.' :
      'Sem nota válida de microfone ou sem melodia de referência. Cante com o microfone ativo para entrar no ranking.';
    $('singerName').value = (() => {try{return localStorage.getItem(NAME_KEY) || '';}catch{return '';}})();
    $('saveResult').disabled = !recordable;
    $('resultModal').hidden = false;
    stopMic();
  }
  function exitPlayer() {
    pausePlayback(); stopMic();
    $('resultModal').hidden = true; $('playerScreen').hidden = true;
    document.body.style.overflow = '';
    state.song = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  function saveResult() {
    if (!state.song || !state.scoreAvailable || state.heard < 1) return;
    const name = $('singerName').value.trim().slice(0, 32);
    if (!name) {toast('Digite o nome do cantor para salvar.'); $('singerName').focus(); return;}
    const grade = gradeFor(state.currentScore);
    const list = readRanking();
    list.push({name, songId: state.song.id, songTitle: state.song.title,
      score: state.currentScore, grade: grade.grade, createdAt: new Date().toISOString()});
    if (saveRanking(list)) {
      try {localStorage.setItem(NAME_KEY, name);}catch {}
      refreshRanking(); updateHeroStats(); exitPlayer(); showSection('ranking');
      toast('Apresentação salva no ranking local!');
    }
  }
  async function importLocal(event) {
    event.preventDefault();
    $('importMessage').textContent = '';
    const file = $('importAudio').files[0];
    const title = $('importTitleInput').value.trim();
    const artist = $('importArtistInput').value.trim();
    if (!title || !artist || !file) return;
    if (file.size > 350 * 1024 * 1024) { $('importMessage').textContent = 'Arquivo muito grande para um teste local.'; return; }
    try {
      const lrc = $('importLyrics').files[0] ? await $('importLyrics').files[0].text() : '';
      const melodyText = $('importMelody').files[0] ? await $('importMelody').files[0].text() : null;
      const melody = melodyText ? JSON.parse(melodyText) : null;
      if (melodyText && !normalizeMelody(melody).length) throw new Error('O arquivo de melodia não contém notas válidas.');
      const url = URL.createObjectURL(file);
      state.tempUrls.push(url);
      const song = {id: 'local-' + Date.now(), title, artist, genre: 'Meus testes',
        audio: url, inlineLyrics: lrc, inlineMelody: melody, melody: melody ? 'local' : null,
        tint: 'green', local: true};
      state.songs.unshift(song);
      $('importModal').hidden = true;
      $('importForm').reset();
      state.genre = 'Todas'; $('searchInput').value = '';
      renderCatalog(); updateHeroStats(); refreshRanking();
      toast('Música adicionada para teste nesta sessão. Nenhum arquivo foi enviado.');
      await openSong(song);
    } catch (error) {
      console.error(error);
      $('importMessage').textContent = error.message || 'Arquivo inválido.';
    }
  }
  $('searchInput').addEventListener('input', renderCatalog);
  $('rankingSong').addEventListener('change', refreshRanking);
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => showSection(el.dataset.nav)));
  $('exploreBtn').addEventListener('click', () => $('catalogSection').scrollIntoView({behavior: 'smooth'}));
  $('demoBtn').addEventListener('click', () => openSong(state.songs.find(s => s.id === DEMO_ID) || demoSong));
  $('importOpen').addEventListener('click', () => {$('importModal').hidden = false; $('importTitleInput').focus();});
  $('importClose').addEventListener('click', () => {$('importModal').hidden = true;});
  $('importForm').addEventListener('submit', importLocal);
  $('playPause').addEventListener('click', () => state.playing ? pausePlayback() : startPlayback());
  $('restartButton').addEventListener('click', replaySong);
  $('micButton').addEventListener('click', toggleMic);
  $('exitPlayer').addEventListener('click', exitPlayer);
  $('seekBar').addEventListener('change', (ev) => seekSong(Number(ev.target.value) / 1000));
  $('playerVolume').addEventListener('input', (ev) => {
    const value = Number(ev.target.value) / 100;
    audio.volume = value;
    if (state.demoGain) state.demoGain.gain.value = value * .65;
  });
  $('saveResult').addEventListener('click', saveResult);
  $('resultReplay').addEventListener('click', replaySong);
  $('resultExit').addEventListener('click', exitPlayer);
  $('clearRanking').addEventListener('click', () => {
    if (!confirm('Deseja apagar todos os resultados deste navegador?')) return;
    try {localStorage.removeItem(DB_KEY);}catch {}
    refreshRanking(); updateHeroStats(); toast('Ranking local apagado.');
  });
  $('fullScreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('playerScreen').requestFullscreen) await $('playerScreen').requestFullscreen();
      else toast('Tela cheia indisponível neste navegador.');
    } catch { toast('Este navegador não permitiu tela cheia.'); }
  });
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (ev) => {if (ev.target === modal && modal.id === 'importModal') modal.hidden = true;});
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('importModal').hidden) $('importModal').hidden = true;
    else if (ev.key === ' ' && !$('playerScreen').hidden && $('resultModal').hidden &&
      !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
      ev.preventDefault(); state.playing ? pausePlayback() : startPlayback();
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    if (state.song && !state.song.demo && Number.isFinite(audio.duration)) {
      state.duration = audio.duration;
      renderFrame(true);
    }
  });
  audio.addEventListener('ended', finishSong);
  audio.addEventListener('error', () => {
    if (state.song && !state.song.demo) toast('Erro ao abrir o áudio. Confira o arquivo ou o caminho no catálogo.');
  });
  window.addEventListener('beforeunload', () => {
    stopMic();
    for (const url of state.tempUrls) URL.revokeObjectURL(url);
  });
  $('brandLink').addEventListener('click', (ev) => {ev.preventDefault(); showSection('catalog');});
  loadCatalog();
})();
