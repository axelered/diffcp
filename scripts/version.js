import fs from 'node:fs';
import path from 'node:path';

const [, , version] = process.argv;

if (!version) {
	console.error('Usage: node scripts/version.mjs <version>');
	process.exit(1);
}

const repoRoot = process.cwd();

// Find all packages in the repo
function getPackages(dir) {
	const ignoredDirs = new Set([
		'node_modules',
		'.git',
		'dist',
		'build',
		'coverage',
		'.next',
		'.turbo',
		'.pnpm-store',
	]);

	let packages = {}
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (ignoredDirs.has(entry.name)) continue;
			packages = {...packages, ...getPackages(fullPath) };
		} else if (entry.isFile() && entry.name === 'package.json') {
			const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
			if (pkg.name) {
				packages[pkg.name] = fullPath;
			}
		}
	}

	return packages;
}


function rewriteWorkspaceRange(current) {
	const suffix = current.slice(current.indexOf(':') + 1);
	if (suffix === '' || suffix === '*') return version;
	if (suffix === '^') return `^${version}`;
	if (suffix === '~') return `~${version}`;
	return version;
}


const localPackages = getPackages(repoRoot)
for (const [pkgName, pkgPath] of Object.entries(localPackages)) {
	const raw = fs.readFileSync(pkgPath, 'utf8');
	const pkg = JSON.parse(raw);

	pkg.version = version;
	for (const field of [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies',
	]) {
		const deps = pkg[field]
		if (!deps) continue;
		for (const [name, current] of Object.entries(deps)) {
			if (typeof current !== 'string') continue;
			if (!localPackages[name]) continue;
			deps[name] = rewriteWorkspaceRange(current);
		}
	}

	fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
	console.log(`updated ${path.relative(repoRoot, pkgPath)} -> ${version}`);
}
