#!/usr/bin/env node
/**
 * ============================================================================
 * check-pets.mjs —— 宠物包健康检查（prepack 门禁，也供开发时手动运行）
 * ============================================================================
 *
 * 【作用】
 *   `node scripts/check-pets.mjs`（npm pack/publish 前由 prepack 自动触发）。
 *   逐项检查宠物包是否可用，任何一项失败置 exit code 1，阻止发布坏包：
 *
 *     1. 必需文件存在（lib 两半侧、类型声明、patch、eason 宠物包）
 *     2. 每个宠物包的 pet.json 可解析且通过形状校验（id 与目录名一致）
 *     3. 目录引用的每个动画名有对应 thumb .webm（防运行时 404）
 *     4. thumb 下每个 .webm 都被目录引用（防孤儿素材白白进包）
 *     5. 原始 1200×1200 母版不得进包（assets/pets/<id>/*.webm 裸文件）
 *     6. client bundle 是官方形态（__ModuleLoader__.load + exports.apply）
 *     7. package.json 声明了 dsh.bundle.patch、dsh.client、files 含 assets/pets
 *
 * ============================================================================
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PETS_ROOT = join(ROOT, 'assets', 'pets');
const fail = (msg) => { console.error(`[check-pets] FAIL: ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`[check-pets] ok: ${msg}`);

// ---- 1. 必需文件 ----
const required = [
	'lib/index.js',
	'lib/client.js',
	'lib/types/index.d.ts',
	'lib/types/client/index.d.ts',
	'cordis.patch.yml',
	'assets/pets/eason/pet.json',
];
for (const f of required) {
	existsSync(join(ROOT, f)) ? ok(`exists ${f}`) : fail(`missing ${f}`);
}

// ---- pet.json 形状校验 ----
function checkDescriptor(desc, dirName, file) {
	if (typeof desc !== 'object' || desc === null) return 'not an object';
	if (desc.id !== dirName) return `id '${desc.id}' !== directory name '${dirName}'`;
	if (typeof desc.label !== 'string' || desc.label.length === 0) return 'missing label';
	if (!desc.canvas || typeof desc.canvas.w !== 'number' || typeof desc.canvas.h !== 'number') return 'missing canvas {w,h}';
	if (typeof desc.feetY !== 'number') return 'missing feetY';
	const c = desc.catalog;
	if (!c || typeof c.idle !== 'string') return 'catalog.idle missing';
	if (typeof c.drag !== 'string') return 'catalog.drag missing';
	if (typeof c.walkLeft !== 'string' || typeof c.walkRight !== 'string') return 'catalog.walkLeft/walkRight missing';
	if (!Array.isArray(c.turns) || !Array.isArray(c.acts) || !Array.isArray(c.clicks)) return 'catalog.turns/acts/clicks must be arrays';
	return null;
}

// ---- 2/3/4. 逐宠物包核对目录 ↔ 素材 ----
let packCount = 0;
for (const entry of readdirSync(PETS_ROOT, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const dir = join(PETS_ROOT, entry.name);
	const descPath = join(dir, 'pet.json');
	if (!existsSync(descPath)) { fail(`pet pack without pet.json: ${entry.name}`); continue; }
	packCount += 1;
	let desc;
	try {
		desc = JSON.parse(readFileSync(descPath, 'utf8'));
	} catch (err) {
		fail(`pet.json unreadable for ${entry.name}: ${err.message}`);
		continue;
	}
	const shapeErr = checkDescriptor(desc, entry.name, descPath);
	if (shapeErr) { fail(`pet.json invalid for ${entry.name}: ${shapeErr}`); continue; }
	ok(`pet.json valid: ${entry.name} («${desc.label}», ${desc.catalog.acts.length} acts)`);

	// 目录引用的动画名集合（七个角色全展开）
	const catalogNames = new Set([
		desc.catalog.idle,
		desc.catalog.drag,
		desc.catalog.walkLeft,
		desc.catalog.walkRight,
		...desc.catalog.turns,
		...desc.catalog.acts,
		...desc.catalog.clicks,
	]);
	const thumbDir = join(dir, 'thumb');
	let stems = [];
	try {
		stems = readdirSync(thumbDir).filter((n) => n.endsWith('.webm')).map((n) => n.slice(0, -5));
	} catch (err) {
		fail(`thumb dir unreadable for ${entry.name}: ${thumbDir}`);
	}
	const stemSet = new Set(stems);
	let bad = 0;
	for (const name of catalogNames) {
		if (!stemSet.has(name)) { fail(`[${entry.name}] catalog animation has no asset file: ${name}.webm`); bad += 1; }
	}
	for (const stem of stems) {
		if (!catalogNames.has(stem)) { fail(`[${entry.name}] asset file never referenced in catalog: ${stem}.webm`); bad += 1; }
	}
	if (bad === 0) ok(`[${entry.name}] catalog ↔ thumb in sync (${stems.length} animations)`);

	// ---- 5. 母版不得进包（包根下的裸 .webm；full/ 只该存在于 $DSH_HOME 投放区） ----
	for (const name of readdirSync(dir)) {
		if (name.endsWith('.webm')) fail(`[${entry.name}] original master must not ship in the package: ${name}`);
	}
	if (existsSync(join(dir, 'full'))) fail(`[${entry.name}] full/ masters must live in $DSH_HOME/aqua-pets, not in the package`);
}
if (packCount === 0) fail('no pet packs found under assets/pets/');
else ok(`pet packs found: ${packCount}`);

// ---- 6. client bundle 官方形态 ----
const client = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
client.includes('__ModuleLoader__.load') ? ok('client bundle shape OK') : fail('client.js missing __ModuleLoader__.load');
client.includes('exports.apply') ? ok('client exports apply') : fail('client.js missing exports.apply');
client.includes('registerAquaPet') ? ok('client contains pet engine') : fail('client.js missing pet engine (registerAquaPet)');

// ---- 7. package.json 声明 ----
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
if (pkg.dsh?.bundle?.patch) ok('dsh.bundle.patch declared');
else fail('package.json missing dsh.bundle.patch');
if (pkg.dsh?.client?.platform === 'web') ok('dsh.client.web declared');
else fail('package.json missing dsh.client platform web');
if (Array.isArray(pkg.files) && pkg.files.some((f) => String(f).startsWith('assets/pets'))) ok('files includes assets/pets');
else fail('package.json files must include assets/pets (pet webm must ship)');

// ---- 汇总 ----
if (process.exitCode) console.error('\n[check-pets] fix the failures above before packing/publishing.');
else console.log('\n[check-pets] all checks passed — ready to pack/publish.');
