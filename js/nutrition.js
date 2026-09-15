"use strict";
/* =====================================================================
   Nutrition / calorie estimator — fully independent of the ring and
   Bluetooth. Takes one free-text line describing a meal in everyday
   Chinese or English ("米饭一碗大概三两 葡萄10粒 羊肉一块大约509克 巧克力一块")
   and returns a rough calorie + macro estimate per item and in total.

   This is a casual, back-of-envelope estimator (like a kitchen scale
   guess), not a lab measurement or dietary prescription — the numbers
   here are typical per-100g averages, not values for a specific food
   the person actually ate.
===================================================================== */

/* kcal / protein(g) / carb(g) / fat(g) per 100g (or per 100ml for liquids),
   plus optional per-unit weights in grams for common count-based units. */
const FOOD_DB = [
  { names: ["米饭", "白饭", "rice"], kcal: 116, p: 2.6, c: 25.9, f: 0.3, units: { "碗": 150, "份": 150 } },
  { names: ["白粥", "粥", "porridge", "congee"], kcal: 46, p: 1.1, c: 10, f: 0.2, units: { "碗": 250 } },
  { names: ["面条", "面", "noodle"], kcal: 109, p: 3.4, c: 22, f: 0.6, units: { "碗": 200, "份": 200 } },
  { names: ["馒头", "steamed bun"], kcal: 223, p: 7, c: 47, f: 1.1, units: { "个": 100 } },
  { names: ["面包", "bread", "吐司"], kcal: 265, p: 9, c: 49, f: 3.2, units: { "片": 30, "个": 60 } },
  { names: ["葡萄", "grape"], kcal: 69, p: 0.6, c: 18, f: 0.2, units: { "粒": 5, "颗": 5, "串": 200 } },
  { names: ["苹果", "apple"], kcal: 52, p: 0.3, c: 14, f: 0.2, units: { "个": 180 } },
  { names: ["香蕉", "banana"], kcal: 89, p: 1.1, c: 23, f: 0.3, units: { "个": 120, "根": 120 } },
  { names: ["橙子", "橘子", "orange"], kcal: 47, p: 0.9, c: 12, f: 0.1, units: { "个": 150 } },
  { names: ["西瓜", "watermelon"], kcal: 30, p: 0.6, c: 8, f: 0.2, units: { "块": 200, "片": 200 } },
  { names: ["土豆", "马铃薯", "potato"], kcal: 77, p: 2, c: 17, f: 0.1, units: { "个": 150 } },
  { names: ["羊肉", "lamb", "mutton"], kcal: 203, p: 19, c: 0, f: 14, units: { "块": 100, "份": 150 } },
  { names: ["牛肉", "beef"], kcal: 250, p: 26, c: 0, f: 15, units: { "块": 100, "份": 150 } },
  { names: ["猪肉", "五花肉", "pork"], kcal: 395, p: 14, c: 0, f: 37, units: { "块": 100, "份": 150 } },
  { names: ["鸡胸肉", "鸡胸", "chicken breast"], kcal: 133, p: 27, c: 0, f: 1.9, units: { "块": 120, "份": 150 } },
  { names: ["鸡肉", "chicken"], kcal: 167, p: 20, c: 0, f: 9, units: { "块": 120, "份": 150 } },
  { names: ["鸡蛋", "蛋", "egg"], kcal: 144, p: 12.6, c: 1.1, f: 9.9, units: { "个": 50, "颗": 50 } },
  { names: ["牛奶", "milk"], kcal: 54, p: 3, c: 5, f: 3.2, units: { "杯": 240, "瓶": 250 }, perMl: true },
  { names: ["巧克力", "chocolate"], kcal: 546, p: 6, c: 58, f: 33, units: { "块": 8, "格": 8, "条": 45 } },
  { names: ["酸奶", "yogurt"], kcal: 72, p: 2.5, c: 9.3, f: 2.7, units: { "杯": 200, "瓶": 200 } },
  { names: ["豆腐", "tofu"], kcal: 82, p: 8, c: 4, f: 4, units: { "块": 150 } }
];
const GENERIC_UNIT_GRAMS = { "碗": 200, "个": 100, "片": 30, "块": 50, "粒": 5, "颗": 5, "根": 100, "杯": 240, "勺": 15, "匙": 15, "份": 150, "串": 100, "条": 80, "只": 100, "瓶": 250 };
const CN_NUM = { "零": 0, "半": 0.5, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };

function cnToNumber(str) {
  if (/^\d+\.?\d*$/.test(str)) return parseFloat(str);
  if (str in CN_NUM) return CN_NUM[str];
  let m = str.match(/^十([一二三四五六七八九])?$/);
  if (m) return 10 + (m[1] ? CN_NUM[m[1]] : 0);
  m = str.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/);
  if (m) return CN_NUM[m[1]] * 10 + (m[2] ? CN_NUM[m[2]] : 0);
  return null;
}

const NUM_PATTERN = "(\\d+\\.?\\d*|[一二两三四五六七八九十半]+)";
const RE_GRAM = new RegExp(NUM_PATTERN + "\\s*(克|g|公克)", "i");
const RE_ML = new RegExp(NUM_PATTERN + "\\s*(毫升|ml)", "i");
const RE_CNWEIGHT = new RegExp(NUM_PATTERN + "\\s*(千克|公斤|kg|斤|两)", "i");
const RE_UNIT = new RegExp(NUM_PATTERN + "\\s*(碗|个|片|块|粒|颗|根|杯|勺|匙|份|串|条|只|瓶|格)");

function findFood(segment) {
  const sorted = [...FOOD_DB].sort((a, b) => Math.max(...b.names.map(n => n.length)) - Math.max(...a.names.map(n => n.length)));
  for (const food of sorted) {
    for (const name of food.names) {
      if (segment.toLowerCase().includes(name.toLowerCase())) return { food, matchedName: name };
    }
  }
  return null;
}

function resolveGrams(segment, food) {
  let m = segment.match(RE_GRAM);
  if (m) { const n = cnToNumber(m[1]); if (n != null) return { grams: n, basis: `${m[1]}${m[2]}`, assumed: false }; }
  m = segment.match(RE_ML);
  if (m) { const n = cnToNumber(m[1]); if (n != null) return { grams: n, basis: `${m[1]}${m[2]}`, assumed: false }; }
  m = segment.match(RE_CNWEIGHT);
  if (m) {
    const n = cnToNumber(m[1]);
    if (n != null) {
      const unit = m[2];
      const mult = (unit === "斤") ? 500 : (unit === "两") ? 50 : 1000; // 千克/公斤/kg
      return { grams: n * mult, basis: `${m[1]}${unit}`, assumed: false };
    }
  }
  m = segment.match(RE_UNIT);
  if (m) {
    const n = cnToNumber(m[1]);
    const unit = m[2];
    if (n != null) {
      const perUnit = (food && food.units && food.units[unit]) || GENERIC_UNIT_GRAMS[unit] || 100;
      return { grams: n * perUnit, basis: `${m[1]}${unit} (≈${perUnit}g/${unit})`, assumed: !(food && food.units && food.units[unit]) };
    }
  }
  return { grams: 100, basis: "未注明份量，按100g估算", assumed: true };
}

function splitItems(text) {
  // Real-world inputs separate items with plain whitespace/commas/顿号/newlines;
  // splitting on those directly (rather than trying to detect "end of a food
  // item" via unit characters) is far more robust across phrasing styles.
  return text.split(/[\s，,、\n]+/u).map(s => s.trim()).filter(Boolean);
}

function parseNutritionInput(text) {
  const segments = splitItems(text);
  const items = [];
  for (const seg of segments) {
    const found = findFood(seg);
    const food = found ? found.food : null;
    const { grams, basis, assumed } = resolveGrams(seg, food);
    const ref = food || { kcal: 150, p: 5, c: 20, f: 5 }; // generic fallback average
    const factor = grams / 100;
    items.push({
      raw: seg,
      name: found ? found.matchedName : (seg.replace(/[0-9一二两三四五六七八九十半.]+\s*(克|g|公克|毫升|ml|千克|公斤|kg|斤|两|碗|个|片|块|粒|颗|根|杯|勺|匙|份|串|条|只|瓶|格)/gi, "").trim() || seg),
      recognized: !!found,
      grams: Math.round(grams),
      basis,
      assumed,
      kcal: Math.round(ref.kcal * factor),
      protein: +(ref.p * factor).toFixed(1),
      carb: +(ref.c * factor).toFixed(1),
      fat: +(ref.f * factor).toFixed(1)
    });
  }
  const totals = items.reduce((acc, it) => {
    acc.kcal += it.kcal; acc.protein += it.protein; acc.carb += it.carb; acc.fat += it.fat;
    return acc;
  }, { kcal: 0, protein: 0, carb: 0, fat: 0 });
  totals.protein = +totals.protein.toFixed(1);
  totals.carb = +totals.carb.toFixed(1);
  totals.fat = +totals.fat.toFixed(1);
  return { items, totals };
}

function adviceFor(totals) {
  const lines = [];
  const pct = Math.round((totals.kcal / 2000) * 100);
  lines.push(`约为一位成年人每日 2000 kcal 参考摄入量的 ${pct}%（因人而异，仅供参考）`);
  const kcalFromP = totals.protein * 4, kcalFromC = totals.carb * 4, kcalFromF = totals.fat * 9;
  const kcalSum = kcalFromP + kcalFromC + kcalFromF || 1;
  const carbShare = kcalFromC / kcalSum, proteinShare = kcalFromP / kcalSum, fatShare = kcalFromF / kcalSum;
  if (carbShare > 0.65) lines.push("碳水比例偏高，可以搭配一些蛋白质或蔬菜让这顿更均衡");
  if (proteinShare > 0.4) lines.push("蛋白质占比不低，记得多喝水、搭配蔬果");
  if (fatShare > 0.4) lines.push("脂肪占比偏高，下一餐可以清淡一些");
  if (totals.kcal > 900) lines.push("这顿热量偏高，如果是正餐之外的加餐，可以考虑分次吃完");
  if (!lines.length) lines.push("整体看起来比较均衡");
  return lines;
}

function renderNutritionResult(result) {
  const box = $("nutriResult");
  if (!box) return;
  const { items, totals } = result;
  const rows = items.map(it => `
    <div class="rc">
      <div class="t">${esc(it.name)}${it.recognized ? "" : " (未识别，按通用值估算)"}</div>
      <div>${it.grams}g ${it.assumed ? "· 份量为估算" : ""} · <b>${it.kcal}</b> kcal · P${it.protein} C${it.carb} F${it.fat}</div>
    </div>`).join("");
  const advice = adviceFor(totals).map(t => `<div>• ${esc(t)}</div>`).join("");
  box.innerHTML = `
    <div class="card" style="margin-top:10px">
      <div class="panel-title">🍽 Estimate</div>
      <div style="font-size:28px;font-weight:800;font-family:var(--num-font)">${totals.kcal} <span style="font-size:13px;color:var(--muted);font-weight:600">kcal total</span></div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">Protein ${totals.protein}g · Carbs ${totals.carb}g · Fat ${totals.fat}g</div>
      <div style="margin-top:10px">${rows}</div>
      <div style="margin-top:10px;font-size:12px;color:var(--muted);line-height:1.6">${advice}</div>
      <div style="margin-top:8px;font-size:10px;color:var(--muted);opacity:.75">Rough estimate from typical per-100g averages — not a lab measurement or medical/dietary advice.</div>
    </div>`;
}

function initNutrition() {
  const btn = $("btnNutrition");
  const modal = $("nutriModal");
  const closeBtn = $("btnNutriClose");
  const calcBtn = $("btnNutriCalc");
  const input = $("nutriInput");
  if (!btn || !modal) return;

  btn.onclick = () => { modal.style.display = "flex"; input?.focus(); };
  closeBtn?.addEventListener("click", () => { modal.style.display = "none"; });
  modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });
  calcBtn?.addEventListener("click", () => {
    const text = (input?.value || "").trim();
    if (!text) return;
    const result = parseNutritionInput(text);
    renderNutritionResult(result);
  });
}
