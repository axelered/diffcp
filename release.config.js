export default {
	branches: [
		{
			name: 'main',
		},
		{
			name: 'canary',
			prerelease: true,
		},
	],
	plugins: [
		'@semantic-release/commit-analyzer',
		'@semantic-release/release-notes-generator',
		'@semantic-release/changelog',
		[
			'@semantic-release/exec',
			{
				"prepareCmd": 'node scripts/version.js ${nextRelease.version}',
				"publishCmd": "npm publish -ws",
			}
		],
		'@semantic-release/github',
	],
}