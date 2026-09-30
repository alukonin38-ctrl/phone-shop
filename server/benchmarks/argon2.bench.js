#!/usr/bin/env node
// benchmarks/argon2.bench.js
// Бенчмарк Argon2id: время хеширования/проверки, пропускная способность и расход памяти.
//
// Запуск без VS Code (из папки server):
//   node benchmarks/argon2.bench.js                                      // все пресеты
//   node benchmarks/argon2.bench.js --memory=20480 --parallelism=1 --time=3
//   node benchmarks/argon2.bench.js --iterations=30 --concurrency=1,2,4
//   npm run bench                                                        // то же, что первый вариант
//   npm run bench:20mb                                                   // только 20 МБ + p=1

const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');
const { hashPassword, verifyPassword } = require('../hashService');

// ---------------- Разбор аргументов командной строки ----------------
function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = raw.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] === undefined ? true : match[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const intArg = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
};

const ITERATIONS = intArg(args.iterations, 15);
const WARMUP = intArg(args.warmup, 2);
const CONCURRENCY = String(args.concurrency || '1,2,4')
  .split(',')
  .map(value => intArg(value, 1))
  .filter(value => value > 0);
const PASSWORD = 'BenchPass-2025!';

// ---------------- Наборы параметров ----------------
// memoryCost указывается в КиБ: 20480 КиБ = 20 МБ, 65536 КиБ = 64 МБ.
const PRESETS = [
  { name: 'OWASP default (64 МБ, t=3, p=4)', memoryCost: 65536, timeCost: 3, parallelism: 4 },
  { name: 'OWASP minimum (19 МБ, t=2, p=1)', memoryCost: 19456, timeCost: 2, parallelism: 1 },
  { name: 'Цель задания: 20 МБ, t=3, p=1', memoryCost: 20480, timeCost: 3, parallelism: 1 },
  { name: 'Сравнение: 20 МБ, t=3, p=4', memoryCost: 20480, timeCost: 3, parallelism: 4 }
];

// Если параметры переданы через CLI — считаем только этот набор.
const customParams = {
  memoryCost: intArg(args.memory, null),
  timeCost: intArg(args.time, null),
  parallelism: intArg(args.parallelism, null)
};

const paramSets = customParams.memoryCost || customParams.timeCost || customParams.parallelism
  ? [{
      name: `Пользовательский набор (${(customParams.memoryCost ?? 65536) / 1024} МБ, t=${customParams.timeCost ?? 3}, p=${customParams.parallelism ?? 4})`,
      memoryCost: customParams.memoryCost ?? 65536,
      timeCost: customParams.timeCost ?? 3,
      parallelism: customParams.parallelism ?? 4
    }]
  : PRESETS;

// ---------------- Статистика ----------------
function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = sum / sorted.length;
  const variance = sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / sorted.length;
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: pick(0.5),
    p95: pick(0.95),
    stdev: Math.sqrt(variance),
    opsPerSec: mean > 0 ? 1000 / mean : 0
  };
}

const round = (value, digits = 2) => Number(value.toFixed(digits));
const mb = bytes => round(bytes / 1024 / 1024, 1);

// ---------------- Измерения ----------------
function roundStats(s) {
  return {
    count: s.count,
    minMs: round(s.min),
    maxMs: round(s.max),
    meanMs: round(s.mean),
    medianMs: round(s.median),
    p95Ms: round(s.p95),
    stdevMs: round(s.stdev),
    opsPerSec: round(s.opsPerSec, 1)
  };
}

async function measureHash(params, iterations, warmup) {
  for (let i = 0; i < warmup; i++) await hashPassword(PASSWORD, params);

  const rssBefore = process.memoryUsage().rss;
  const hashTimes = [];
  let hash = '';

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    hash = await hashPassword(PASSWORD, params);
    hashTimes.push(performance.now() - start);
  }

  const rssAfter = process.memoryUsage().rss;
  return { hashTimes, hash, rssDeltaBytes: Math.max(0, rssAfter - rssBefore) };
}

async function measureVerify(hash, iterations) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const ok = await verifyPassword(PASSWORD, hash);
    times.push(performance.now() - start);
    if (!ok) throw new Error('verifyPassword вернул false — бенчмарк некорректен');
  }
  return times;
}

/** Одновременное хеширование N паролей: показывает пропускную способность. */
async function measureConcurrency(params, level, iterations) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await Promise.all(
      Array.from({ length: level }, (_, index) => hashPassword(`${PASSWORD}-${index}`, params))
    );
    times.push(performance.now() - start);
  }
  return times;
}

async function runBenchmark(paramSet, iterations, warmup) {
  const params = {
    memoryCost: paramSet.memoryCost,
    timeCost: paramSet.timeCost,
    parallelism: paramSet.parallelism
  };

  const { hashTimes, hash, rssDeltaBytes } = await measureHash(params, iterations, warmup);
  const verifyTimes = await measureVerify(hash, iterations);

  const hashStats = roundStats(stats(hashTimes));
  const verifyStats = roundStats(stats(verifyTimes));

  const concurrent = [];
  for (const level of CONCURRENCY) {
    const iterationsPerLevel = Math.max(3, Math.round(iterations / 3));
    const times = await measureConcurrency(params, level, iterationsPerLevel);
    const s = stats(times);
    concurrent.push({
      concurrentHashes: level,
      iterations: s.count,
      medianMs: round(s.median),
      throughputPerSec: round((level * 1000) / s.median, 1),
      theoreticalMemoryMb: round((paramSet.memoryCost * level) / 1024, 1)
    });
  }

  return {
    name: paramSet.name,
    memoryMb: round(paramSet.memoryCost / 1024, 1),
    memoryCostKib: paramSet.memoryCost,
    timeCost: paramSet.timeCost,
    parallelism: paramSet.parallelism,
    hashHeader: hash.split('$').slice(0, 4).join('$') + '$...',
    hashLength: hash.length,
    rssDeltaMb: mb(rssDeltaBytes),
    hash: hashStats,
    verify: verifyStats,
    concurrency: concurrent
  };
}

// ---------------- Форматирование отчёта ----------------
const pad = (value, width) => String(value).padEnd(width);

function printTable(results) {
  console.log('\n=== Результаты (Argon2id, ' + ITERATIONS + ' итераций) ===\n');
  console.log(
    pad('Параметры', 34) + pad('Хеш, мс', 10) + pad('Проверка, мс', 13) +
    pad('Хешей/с', 10) + pad('RSS+, МБ', 10)
  );
  console.log('-'.repeat(77));

  for (const result of results) {
    console.log(
      pad(result.name, 34) +
      pad(result.hash.medianMs, 10) +
      pad(result.verify.medianMs, 13) +
      pad(result.hash.opsPerSec, 10) +
      pad(result.rssDeltaMb, 10)
    );
    for (const item of result.concurrency) {
      console.log(
        '   └─ одновременно хешей: ' + pad(item.concurrentHashes, 3) +
        ' медиана ' + pad(item.medianMs + ' мс', 9) +
        ' пропускная способность ' + pad(item.throughputPerSec + '/с', 10) +
        ' память ≈ ' + item.theoreticalMemoryMb + ' МБ'
      );
    }
  }
  console.log('');
}

function buildMarkdown(results, meta) {
  const lines = [];
  lines.push('# Бенчмарк Argon2id');
  lines.push('');
  lines.push(`- Дата: ${meta.date}`);
  lines.push(`- ОС: ${meta.platform} ${meta.arch}`);
  lines.push(`- Node.js: ${meta.nodeVersion}`);
  lines.push(`- CPU: ${meta.cpu} (${meta.cores} логических ядер)`);
  lines.push(`- Итераций на измерение: ${meta.iterations} (прогрев: ${meta.warmup})`);
  lines.push('');
  lines.push('## Время хеширования и проверки');
  lines.push('');
  lines.push('| Параметры | Память | m (КиБ) | t | p | Хеш, медиана мс | Хеш, p95 мс | Проверка, медиана мс | Хешей/с | RSS+, МБ |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${r.name} | ${r.memoryMb} МБ | ${r.memoryCostKib} | ${r.timeCost} | ${r.parallelism} | ${r.hash.medianMs} | ${r.hash.p95Ms} | ${r.verify.medianMs} | ${r.hash.opsPerSec} | ${r.rssDeltaMb} |`);
  }
  lines.push('');
  lines.push('## Одновременное хеширование (пропускная способность)');
  lines.push('');
  lines.push('| Параметры | Одновременных хешей | Медиана, мс | Пропускная способность, хешей/с | Теоретическая память |');
  lines.push('|---|---|---|---|---|');
  for (const r of results) {
    for (const c of r.concurrency) {
      lines.push(`| ${r.name} | ${c.concurrentHashes} | ${c.medianMs} | ${c.throughputPerSec} | ≈ ${c.theoreticalMemoryMb} МБ |`);
    }
  }
  lines.push('');
  lines.push('## Пример строки хеша');
  lines.push('');
  for (const r of results) {
    lines.push(`- ${r.name}: \`${r.hashHeader}\` (длина ${r.hashLength} символов)`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------- Основной сценарий ----------------
function detectCpu() {
  const cpus = os.cpus();
  return {
    model: cpus.length ? String(cpus[0].model).trim() : 'неизвестно',
    cores: cpus.length
  };
}

function printConclusion(results) {
  const target = results.find(r => r.memoryCostKib === 20480 && r.timeCost === 3 && r.parallelism === 1);
  const defaultSet = results.find(r => r.memoryCostKib === 65536 && r.timeCost === 3 && r.parallelism === 4);

  console.log('Выводы:');
  if (target) {
    console.log(`  • 20 МБ + p=1: медиана хеша ${target.hash.medianMs} мс → примерно ${target.hash.opsPerSec} хешей/с`);
    console.log('  • один процесс хеширования занимает примерно 20 МБ памяти;');
    console.log('    10 одновременных хешей ≈ 200 МБ, 50 одновременных ≈ 1 ГБ — столько и надо резервировать серверу.');
  }
  if (target && defaultSet) {
    const ratio = round(target.hash.medianMs / defaultSet.hash.medianMs, 2);
    console.log(`  • относительно набора OWASP (64 МБ, t=3, p=4) время хеша составляет ${ratio}x`);
  }
  console.log('');
}

async function main() {
  const cpu = detectCpu();

  console.log('Бенчмарк Argon2id (@node-rs/argon2 — нативная реализация)');
  console.log(`Node.js ${process.version}, ${os.platform()} ${os.arch()}, CPU: ${cpu.model} (${cpu.cores} ядер)`);
  console.log(`Пароль: "${PASSWORD}", итераций на набор параметров: ${ITERATIONS} (прогрев: ${WARMUP})`);

  const results = [];
  for (const paramSet of paramSets) {
    process.stdout.write(`\n▶ ${paramSet.name} — измеряем...`);
    const result = await runBenchmark(paramSet, ITERATIONS, WARMUP);
    results.push(result);
    process.stdout.write(` готово (медиана хеша ${result.hash.medianMs} мс)\n`);
  }

  printTable(results);
  printConclusion(results);

  // ---------- Сохранение артефактов ----------
  const resultsDir = path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const meta = {
    date: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpu: cpu.model,
    cores: cpu.cores,
    iterations: ITERATIONS,
    warmup: WARMUP,
    concurrencyLevels: CONCURRENCY,
    passwordLength: PASSWORD.length
  };

  const jsonPath = path.join(resultsDir, `argon2-bench-${stamp}.json`);
  const mdPath = path.join(resultsDir, `argon2-bench-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
  fs.writeFileSync(mdPath, buildMarkdown(results, meta), 'utf8');

  console.log('Артефакты бенчмарка сохранены:');
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
  console.log('');
}

main().catch(err => {
  console.error('Бенчмарк упал с ошибкой:', err);
  process.exit(1);
});
