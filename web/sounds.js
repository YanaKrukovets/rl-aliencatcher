// Sound effects factory — returns play* helpers that gate on soundEnabledRef
export function createSounds(audioCtx, soundEnabledRef) {
  const snd = (fn) => { if (soundEnabledRef.current) fn(); };

  const playShoot = () => snd(() => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(900, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.22, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.08);
  });

  const playCatch = (isGolden, isQueen) => snd(() => {
    const freqs = isQueen ? [880, 1320, 1760] : isGolden ? [660, 990, 1320] : [880, 1108];
    freqs.forEach((freq, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t); o.stop(t + 0.22);
    });
  });

  const playHit = () => snd(() => {
    const n = Math.floor(audioCtx.sampleRate * 0.18);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
    src.buffer = buf; src.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    src.start(audioCtx.currentTime);
  });

  const playExplosion = () => snd(() => {
    const n = Math.floor(audioCtx.sampleRate * 0.25);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 0.6);
    const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
    src.buffer = buf; src.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.38, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    src.start(audioCtx.currentTime);
  });

  const playMeteorExplosion = () => snd(() => {
    const dur = 0.45;
    const n = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 0.4);
    const src = audioCtx.createBufferSource(), ng = audioCtx.createGain();
    src.buffer = buf; ng.gain.value = 0.55;
    src.connect(ng); ng.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);

    const sub = audioCtx.createOscillator(), sg = audioCtx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, audioCtx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(28, audioCtx.currentTime + 0.18);
    sg.gain.setValueAtTime(0.7, audioCtx.currentTime);
    sg.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    sub.connect(sg); sg.connect(audioCtx.destination);
    sub.start(audioCtx.currentTime); sub.stop(audioCtx.currentTime + 0.23);
  });

  const playMeteorImpact = () => snd(() => {
    const sub = audioCtx.createOscillator(), sg = audioCtx.createGain();
    sub.type = "sawtooth";
    sub.frequency.setValueAtTime(120, audioCtx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.25);
    sg.gain.setValueAtTime(0.9, audioCtx.currentTime);
    sg.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    sub.connect(sg); sg.connect(audioCtx.destination);
    sub.start(audioCtx.currentTime); sub.stop(audioCtx.currentTime + 0.31);

    const n = Math.floor(audioCtx.sampleRate * 0.2);
    const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = audioCtx.createBufferSource(), ng = audioCtx.createGain();
    src.buffer = buf; ng.gain.value = 0.45;
    src.connect(ng); ng.connect(audioCtx.destination);
    src.start(audioCtx.currentTime);
  });

  const playMeteorStormWarning = () => snd(() => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(40, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.4);
    o.frequency.linearRampToValueAtTime(55, audioCtx.currentTime + 0.8);
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.9);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.95);
  });

  const playLevelUp = () => snd(() => {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    });
  });

  const playRockHit = () => snd(() => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(480, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.06);
    g.gain.setValueAtTime(0.35, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.08);

    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.06, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const ns = audioCtx.createBufferSource(), ng = audioCtx.createGain();
    ns.buffer = buf; ng.gain.value = 0.18;
    ns.connect(ng); ng.connect(audioCtx.destination);
    ns.start(audioCtx.currentTime);
  });

  const playGameOver = () => snd(() => {
    [440, 370, 294, 220].forEach((freq, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "sawtooth"; o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
  });

  const playWin = () => snd(() => {
    const fanfare = [523, 659, 784, 1047, 1319, 1568];
    fanfare.forEach((freq, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "sine"; o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.start(t); o.stop(t + 0.6);
    });
    [[523, 0.5], [659, 0.6], [784, 0.7]].forEach(([freq, delay]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = "triangle"; o.frequency.value = freq;
      const t = audioCtx.currentTime + delay;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.start(t); o.stop(t + 0.85);
    });
  });

  const playHoHoHo = () => snd(() => {
    const t = audioCtx.currentTime;
    // Each "HO" drops in pitch — natural laugh descends
    const pitches = [155, 140, 125];
    [0, 0.62, 1.24].forEach((offset, idx) => {
      const start = t + offset;
      const dur = 0.36;
      const pitch = pitches[idx];

      // "H" — bandpass-filtered noise (breathy consonant onset)
      const nLen = Math.floor(audioCtx.sampleRate * 0.07);
      const nBuf = audioCtx.createBuffer(1, nLen, audioCtx.sampleRate);
      const nd = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nLen, 0.8);
      const nSrc = audioCtx.createBufferSource(); nSrc.buffer = nBuf;
      const nBp = audioCtx.createBiquadFilter();
      nBp.type = "bandpass"; nBp.frequency.value = 1400; nBp.Q.value = 1.5;
      const nGain = audioCtx.createGain(); nGain.gain.value = 0.65;
      nSrc.connect(nBp); nBp.connect(nGain); nGain.connect(audioCtx.destination);
      nSrc.start(start);

      // "O" vowel — sawtooth through formant filters (F1≈500Hz, F2≈900Hz)
      const voice = audioCtx.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(pitch, start + 0.04);
      voice.frequency.exponentialRampToValueAtTime(pitch * 0.62, start + dur);
      const vGain = audioCtx.createGain();
      vGain.gain.setValueAtTime(0, start);
      vGain.gain.linearRampToValueAtTime(0.9, start + 0.06);
      vGain.gain.setValueAtTime(0.9, start + dur - 0.07);
      vGain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      // Formant 1 — low resonance peak shapes the "O" vowel body
      const f1 = audioCtx.createBiquadFilter();
      f1.type = "bandpass"; f1.frequency.value = 500; f1.Q.value = 5;
      const f1g = audioCtx.createGain(); f1g.gain.value = 1.3;
      // Formant 2 — upper resonance adds vowel brightness/clarity
      const f2 = audioCtx.createBiquadFilter();
      f2.type = "bandpass"; f2.frequency.value = 875; f2.Q.value = 6;
      const f2g = audioCtx.createGain(); f2g.gain.value = 0.65;
      voice.connect(vGain);
      vGain.connect(f1); f1.connect(f1g); f1g.connect(audioCtx.destination);
      vGain.connect(f2); f2.connect(f2g); f2g.connect(audioCtx.destination);

      // Sub-bass belly rumble underneath
      const bass = audioCtx.createOscillator();
      bass.type = "sine";
      bass.frequency.setValueAtTime(pitch * 0.5, start + 0.04);
      bass.frequency.exponentialRampToValueAtTime(pitch * 0.32, start + dur);
      const bGain = audioCtx.createGain();
      bGain.gain.setValueAtTime(0, start);
      bGain.gain.linearRampToValueAtTime(0.45, start + 0.06);
      bGain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      bass.connect(bGain); bGain.connect(audioCtx.destination);

      voice.start(start + 0.04); voice.stop(start + dur + 0.05);
      bass.start(start + 0.04); bass.stop(start + dur + 0.05);
    });
  });

  return {
    snd, playShoot, playCatch, playHit, playExplosion,
    playMeteorExplosion, playMeteorImpact, playMeteorStormWarning,
    playLevelUp, playRockHit, playGameOver, playWin, playHoHoHo,
  };
}

// Background music system — returns { bgGain, start, stop }
export function createBackgroundMusic(audioCtx, soundEnabledRef, getLevel, getWinMusicActive) {
  const bgGain = audioCtx.createGain();
  bgGain.gain.value = soundEnabledRef.current ? 0.18 : 0;
  bgGain.connect(audioCtx.destination);

  const playBgNote = (freq, type, vol, dur) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(bgGain);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + dur + 0.01);
  };

  const playBgKick = () => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.8, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    o.connect(g); g.connect(bgGain);
    o.start(audioCtx.currentTime); o.stop(audioCtx.currentTime + 0.13);
  };

  const playBgSnare = () => {
    const bufLen = Math.floor(audioCtx.sampleRate * 0.09);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = audioCtx.createBufferSource(), sg = audioCtx.createGain();
    src.buffer = buf; sg.gain.value = 0.28;
    src.connect(sg); sg.connect(bgGain);
    src.start(audioCtx.currentTime);
  };

  const playBgHat = () => {
    const bufLen = Math.floor(audioCtx.sampleRate * 0.025);
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = audioCtx.createBufferSource(), hg = audioCtx.createGain();
    src.buffer = buf; hg.gain.value = 0.1;
    src.connect(hg); hg.connect(bgGain);
    src.start(audioCtx.currentTime);
  };

  const PATTERN_CYCLE = [0, 1, 0, 2];

  const MUSIC_PHASES = [
    { // Level 1-2: C major, bright, 155 BPM
      bpm: 155, hatEvery: 2,
      melodies: [
        [523,null,659,null,784,659,null,523, 440,null,523,null,659,784,659,null],
        [784,659,784,null,1047,null,784,659, 587,null,698,587,null,523,587,null],
        [659,null,null,587,523,null,587,null, 659,null,523,null,440,null,392,null],
      ],
      bass: [
        [131,null,131,null,131,null,131,null, 110,null,110,null,131,null,131,null],
        [131,165,null,196,null,175,165,null, 110,131,null,165,null,147,131,null],
      ],
      counter: { steps:[2,10], freqs:[1047,880], prob:0.55 },
      chords: [[523,659,784],[440,523,659]],
    },
    { // Level 3-5: D minor, tense, 168 BPM
      bpm: 168, hatEvery: 2,
      melodies: [
        [587,null,698,null,880,698,null,587, 523,null,587,null,698,880,698,null],
        [880,698,880,null,1047,null,880,698, 784,null,880,784,null,698,784,null],
        [698,null,null,659,587,null,659,null, 698,null,587,null,523,null,587,null],
      ],
      bass: [
        [147,null,147,null,147,null,147,null, 131,null,131,null,147,null,147,null],
        [147,175,null,220,null,196,175,null, 131,147,null,175,null,165,147,null],
      ],
      counter: { steps:[4,12], freqs:[1047,880], prob:0.5 },
      chords: [[587,698,880],[523,659,784]],
    },
    { // Level 6-9: E minor, urgent, 180 BPM
      bpm: 180, hatEvery: 1,
      melodies: [
        [659,784,659,null,988,784,659,null, 587,null,659,587,null,494,587,null],
        [988,null,784,988,null,880,784,null, 659,784,null,880,784,null,659,null],
        [784,659,null,784,659,null,784,null, 880,784,659,null,784,659,null,659],
      ],
      bass: [
        [165,null,165,null,196,null,196,null, 131,null,131,null,165,null,165,null],
        [165,196,null,247,null,220,196,null, 131,165,null,196,null,175,165,null],
      ],
      counter: { steps:[3,7,11,15], freqs:[1319,1047,988,1047], prob:0.4 },
      chords: [[659,784,988],[523,659,784]],
    },
    { // Level 10+: A minor, intense, 200 BPM
      bpm: 200, hatEvery: 1,
      melodies: [
        [880,null,1047,880,null,784,880,null, 659,880,null,784,659,null,587,null],
        [1047,988,880,784,880,null,659,null, 784,880,784,659,null,587,659,null],
        [659,784,880,null,1047,null,880,784, 659,null,784,null,880,784,null,659],
      ],
      bass: [
        [110,null,110,null,220,null,220,null, 110,null,110,null,131,null,131,null],
        [110,131,null,165,null,147,131,null, 110,131,null,165,null,175,131,null],
      ],
      counter: { steps:[1,5,9,13], freqs:[1319,1175,1047,1175], prob:0.6 },
      chords: [[440,523,659],[392,494,659]],
    },
  ];

  const getPhase = () => {
    const level = getLevel();
    if (level <= 2) return MUSIC_PHASES[0];
    if (level <= 5) return MUSIC_PHASES[1];
    if (level <= 9) return MUSIC_PHASES[2];
    return MUSIC_PHASES[3];
  };

  const WIN_MUSIC = {
    bpm: 188,
    melodies: [
      [1047,null,1319,null,1568,null,1319,1047, 1175,null,1047,null,1319,null,1568,null],
      [1568,1319,1047,null,1319,1568,1047,null, 1319,1047,null,880,1047,1319,null,1568],
      [1047,1175,1319,null,1568,1319,1175,null, 1047,null,1319,null,1568,null,1047,null],
    ],
    bass: [523,null,523,null,659,null,659,null, 523,null,440,null,523,null,659,null],
    chords: [[523,659,784,1047],[440,523,659,880],[349,440,523,659]],
    counter: [2093,null,2093,null,1760,null,1760,null, 2093,null,null,null,1568,null,null,null],
  };

  let stepIdx = 0;
  let globalBar = 0;
  let currentPhaseIdx = -1;
  let melodyTimeout = null;

  const scheduleStep = () => {
    if (getWinMusicActive()) {
      const stepMs = Math.round(60000 / WIN_MUSIC.bpm / 2);
      const s = stepIdx % 16;
      if (soundEnabledRef.current) {
        const noteDur = stepMs / 1000 * 0.78;
        const mel = WIN_MUSIC.melodies[Math.floor(globalBar / 2) % 3];
        if (mel[s]) playBgNote(mel[s], "sine", 0.22, noteDur);
        if (WIN_MUSIC.counter[s]) playBgNote(WIN_MUSIC.counter[s], "triangle", 0.1, noteDur * 0.55);
        if (WIN_MUSIC.bass[s]) playBgNote(WIN_MUSIC.bass[s], "square", 0.17, noteDur * 1.1);
        if (s === 0 || s === 8) playBgKick();
        if (s === 4 || s === 12) playBgSnare();
        if (s === 2 || s === 6 || s === 10 || s === 14) playBgSnare();
        if (s % 2 === 0) playBgHat();
        if (s === 0 || s === 8) {
          WIN_MUSIC.chords[s === 0 ? 0 : s === 8 ? 1 : 2].forEach(f => playBgNote(f, "triangle", 0.09, noteDur * 1.5));
        }
      }
      stepIdx++;
      if (s === 15) globalBar++;
      melodyTimeout = setTimeout(scheduleStep, stepMs);
      return;
    }

    const phase = getPhase();
    const stepMs = Math.round(60000 / phase.bpm / 2);
    const s = stepIdx % 16;
    const barInCycle = globalBar % 4;

    const newPhaseIdx = MUSIC_PHASES.indexOf(phase);
    if (newPhaseIdx !== currentPhaseIdx) {
      currentPhaseIdx = newPhaseIdx;
      stepIdx = 0;
      globalBar = 0;
    }

    if (!soundEnabledRef.current) {
      stepIdx++;
      if (s === 15) globalBar++;
      melodyTimeout = setTimeout(scheduleStep, stepMs);
      return;
    }

    const noteDur = stepMs / 1000 * 0.82;
    const patIdx = PATTERN_CYCLE[barInCycle];
    const melody = phase.melodies[patIdx];
    const bass = phase.bass[(barInCycle === 1 || barInCycle === 3) ? 1 : 0];

    if (melody[s]) playBgNote(melody[s], "triangle", 0.28, noteDur);

    if (phase.counter.steps.includes(s) && Math.random() < phase.counter.prob) {
      const ci = phase.counter.steps.indexOf(s);
      playBgNote(phase.counter.freqs[ci], "sine", 0.1, noteDur * 0.65);
    }

    if (bass[s]) playBgNote(bass[s], "square", 0.2, noteDur * 1.15);

    if (s === 0 || s === 8)  playBgKick();
    if (s === 4 || s === 12) playBgSnare();
    if (barInCycle === 3 && (s === 6 || s === 14)) playBgSnare();
    if (s % phase.hatEvery === 0) playBgHat();

    if (s === 0 || s === 8) {
      const chord = phase.chords[s === 0 ? 0 : 1];
      chord.forEach(f => playBgNote(f, "triangle", 0.07, noteDur * 1.3));
    }

    stepIdx++;
    if (s === 15) globalBar++;
    melodyTimeout = setTimeout(scheduleStep, stepMs);
  };

  return {
    bgGain,
    start: () => scheduleStep(),
    stop: () => clearTimeout(melodyTimeout),
  };
}
