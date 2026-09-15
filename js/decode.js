"use strict";
/* ===== Raw byte decoders for each history type (wire format unchanged — do not alter) ===== */

function decodeHR(bytes) {
  const r = [];
  for (let i = 0; i + 6 <= bytes.length; i += 6) {
    const d = ts(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    r.push({ local: fmt(d), t: d.getTime(), hr: bytes[i + 5] });
  }
  return r;
}

function decodeBP(bytes) {
  const r = [];
  for (let i = 0; i + 8 <= bytes.length; i += 8) {
    const d = ts(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    r.push({ local: fmt(d), t: d.getTime(), sys: bytes[i + 5], dia: bytes[i + 6], hr: bytes[i + 7] });
  }
  return r;
}

function decodeAll(bytes) {
  const r = [];
  for (let i = 0; i + 20 <= bytes.length; i += 20) {
    const d = ts(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    r.push({ local: fmt(d), t: d.getTime(), hr: bytes[i + 6], sys: bytes[i + 7], dia: bytes[i + 8], spo2: bytes[i + 9] });
  }
  return r;
}

function decodePressure(bytes) {
  const r = [];
  for (let i = 0; i + 28 <= bytes.length; i += 28) {
    const d = ts(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    r.push({ local: fmt(d), t: d.getTime(), pressure: bytes[i + 13] + 24 });
  }
  return r;
}

function decodeSteps(bytes) {
  const r = [];
  if (!bytes || bytes.length < 10) return r;
  const stride = (bytes.length % 12 === 0 && bytes.length % 10 !== 0) ? 12 : 10;
  for (let i = 0; i + 10 <= bytes.length; i += stride) {
    const d = ts(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    const steps = bytes[i + 4] | (bytes[i + 5] << 8);
    if (steps > 20000) continue;
    const t = d.getTime();
    if (t < Date.now() - 400 * 86400000 || t > Date.now() + 86400000) continue;
    r.push({
      local: fmt(d), t, steps,
      distance: bytes[i + 6] | (bytes[i + 7] << 8),
      calories: bytes[i + 8] | (bytes[i + 9] << 8),
      hour: d.getHours()
    });
  }
  return r;
}

function decodeSleep(bytes) {
  if (!bytes || bytes.length < 8) return null;
  let start = null, end = null, deepSec = 0, lightSec = 0, remSec = 0, sessionCount = 0;
  const segments = [];

  let i = 0;
  while (i + 20 <= bytes.length) {
    const len = bytes[i + 2] | (bytes[i + 3] << 8);
    if (len < 20 || i + len > bytes.length + 4) break;
    const segEnd = Math.min(i + len, bytes.length);
    const sStart = ts(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const sEnd = ts(bytes[i + 8], bytes[i + 9], bytes[i + 10], bytes[i + 11]);
    if (!start || sStart < start) start = sStart;
    if (!end || sEnd > end) end = sEnd;
    for (let j = i + 20; j + 8 <= segEnd; j += 8) {
      const rawTag = bytes[j];
      const stage = rawTag & 0x0f;
      const segStart = ts(bytes[j + 1], bytes[j + 2], bytes[j + 3], bytes[j + 4]);
      const durSec = bytes[j + 5] | (bytes[j + 6] << 8);
      if (durSec > 0 && durSec < 86400) {
        segments.push({ type: rawTag, stage, start: segStart, durSec });
        if (stage === 1 || rawTag === 0xf1) deepSec += durSec;
        else if (stage === 2 || rawTag === 0xf2) lightSec += durSec;
        else if (stage === 3 || rawTag === 0xf3) remSec += durSec;
      }
    }
    sessionCount++;
    i += len;
  }

  if (!segments.length && bytes.length >= 8) {
    for (let j = 0; j + 8 <= bytes.length; j++) {
      const rawTag = bytes[j];
      const stage = rawTag & 0x0f;
      if (stage < 1 || stage > 3) continue;
      const segStart = ts(bytes[j + 1], bytes[j + 2], bytes[j + 3], bytes[j + 4]);
      const t = segStart.getTime();
      if (t < Date.now() - 400 * 86400000 || t > Date.now() + 86400000) continue;
      const durSec = bytes[j + 5] | (bytes[j + 6] << 8);
      if (durSec <= 0 || durSec > 86400) continue;
      segments.push({ type: rawTag, stage, start: segStart, durSec });
      if (stage === 1) deepSec += durSec;
      else if (stage === 2) lightSec += durSec;
      else if (stage === 3) remSec += durSec;
      if (!start || segStart < start) start = segStart;
      const segEnd = new Date(t + durSec * 1000);
      if (!end || segEnd > end) end = segEnd;
      j += 7;
    }
    if (segments.length) sessionCount = 1;
  }

  if (!start || !segments.length) return null;
  const totalSec = deepSec + lightSec + remSec;
  if (totalSec <= 0) return null;
  return {
    start: fmt(start), end: fmt(end),
    deepMin: Math.round(deepSec / 60), lightMin: Math.round(lightSec / 60), remMin: Math.round(remSec / 60),
    totalMin: Math.round(totalSec / 60),
    score: totalSec ? Math.round((deepSec / totalSec) * 100) : 0,
    sessionCount, segments
  };
}
