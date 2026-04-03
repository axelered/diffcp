export default {
	branches: [
		{
			name: 'main'
		},
		{
			name: 'canary',
			prerelease: true
		}
	],
	plugins: [
		'@semantic-release/commit-analyzer',
		'@semantic-release/release-notes-generator',
		'@semantic-release/changelog',
		[
			'@semantic-release/exec',
			{
				prepareCmd: 'node scripts/version.js ${nextRelease.version}'
				// The default engine is execa which internally defaults to SH
				// https://github.com/sindresorhus/execa/blob/main/docs/shell.md
				// for some reason this accesses to an old version of npm
				// publishCmd: 'npm publish -ws --provenance --access public',
			}
		],
		'@semantic-release/github'
	]
}
