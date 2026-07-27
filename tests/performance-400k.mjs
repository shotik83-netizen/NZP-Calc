import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const ROW_COUNT = 400_000;
const contractors = ["ДемоСтрой", "МонолитПроект", "ИнжСервис", "ПромМонтаж", "ТехноСтрой"];
const rateCodes = Array.from({ length: 20 }, (_, index) => `KQ-2-${String(index + 1).padStart(2, "0")}`);
const months = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`);

function normalize(value) {
  return String(value == null ? "" : value).trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

const startedAt = performance.now();
const groups = new Map();
let sourceVolume = 0;

for (let index = 0; index < ROW_COUNT; index += 1) {
  const contractor = contractors[index % contractors.length];
  const rateCode = rateCodes[Math.floor(index / contractors.length) % rateCodes.length];
  const month = months[index % months.length];
  const unit = ["м3", "м2", "т", "шт."][index % 4];
  const volume = 1 + (index % 17) * 0.25;
  const groupKey = [normalize(contractor), normalize(rateCode), normalize(unit), "kq2", "with-regulations"].join("||");
  let group = groups.get(groupKey);
  if (!group) {
    group = { contractor, kqCode: rateCode, unit, actualSmr: 0, rows: 0, monthly: {} };
    groups.set(groupKey, group);
  }
  group.rows += 1;
  group.actualSmr += volume;
  group.monthly[month] = (group.monthly[month] || 0) + volume;
  sourceVolume += volume;
}

const aggregationFinishedAt = performance.now();
const rateIndex = new Map();
contractors.forEach((contractor, contractorIndex) => {
  rateCodes.forEach((rateCode, rateIndexValue) => {
    rateIndex.set(`${normalize(contractor)}||${normalize(rateCode)}`, {
      price: 1250 + (rateIndexValue + 1) * 175 + contractorIndex * 50,
    });
  });
});

let reportTotal = 0;
let matchedGroups = 0;
const monthly = {};
for (const group of groups.values()) {
  const rate = rateIndex.get(`${normalize(group.contractor)}||${normalize(group.kqCode)}`);
  if (!rate) continue;
  matchedGroups += 1;
  reportTotal += group.actualSmr * rate.price;
  Object.entries(group.monthly).forEach(([month, volume]) => {
    monthly[month] = (monthly[month] || 0) + volume * rate.price;
  });
}
const reportFinishedAt = performance.now();

const aggregatedRows = Array.from(groups.values()).reduce((sum, group) => sum + group.rows, 0);
const aggregatedVolume = Array.from(groups.values()).reduce((sum, group) => sum + group.actualSmr, 0);
if (aggregatedRows !== ROW_COUNT) throw new Error(`Потеря строк: ${aggregatedRows} из ${ROW_COUNT}`);
if (Math.abs(aggregatedVolume - sourceVolume) > 1e-6) throw new Error("Нарушена сверка физических объёмов");
if (groups.size !== 100) throw new Error(`Ожидалось 100 групп, получено ${groups.size}`);
if (matchedGroups !== groups.size) throw new Error(`Сопоставлено ${matchedGroups} из ${groups.size} групп`);
if (Object.keys(monthly).length !== 12) throw new Error("Неполная месячная динамика");

const memory = process.memoryUsage();
const result = {
  status: "passed",
  inputRows: ROW_COUNT,
  contractors: contractors.length,
  ratesPerContractor: rateCodes.length,
  aggregatedGroups: groups.size,
  matchedGroups,
  months: Object.keys(monthly).length,
  sourceVolume,
  reportTotal,
  aggregationMs: Math.round((aggregationFinishedAt - startedAt) * 100) / 100,
  reportMs: Math.round((reportFinishedAt - aggregationFinishedAt) * 100) / 100,
  totalMs: Math.round((reportFinishedAt - startedAt) * 100) / 100,
  heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
  rssMb: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
  scope: "Вычислительный контур после декодирования Excel; время XLSX.read зависит от реального файла и измеряется отдельно.",
};

const outputDir = path.resolve("outputs/019fa270-cc27-7932-b6f1-d3db5c821b0a");
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "performance-400k.json"), JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify(result, null, 2));
