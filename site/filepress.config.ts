import { defineFilepressConfig } from 'getfilepress';

const github = 'https://github.com/Catalyst-Forge-LLC/mediatuna';

export default defineFilepressConfig({
	title: 'MediaTuna',
	description:
		'Turn a home media archive into playable MP4 and MP3 without losing dates, tags, or already-finished work.',
	tagline: 'Old tapes, playable files.',
	lede: 'Local batch convert. Dates stay. Sources stay until you say otherwise.',
	url: 'https://mediatuna.dev',
	author: 'Catalyst Forge LLC',
	homePage: 'about',
	topics: [
		{ label: 'Guides', tag: 'guides' },
		{ label: 'Release notes', tag: 'releases' }
	],
	nav: [
		{ label: 'Home', href: '/' },
		{ label: 'Docs', href: '/docs/' },
		{ label: 'Posts', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'GitHub', href: github, icon: 'github' }
	],
	footerLinks: [
		{ label: 'Docs', href: '/docs/' },
		{ label: 'RSS', href: '/rss.xml' },
		{ label: 'Topics', href: '/topics' },
		{ label: 'GitHub', href: github, icon: 'github' }
	],
	paths: [{ url: '/docs', dir: 'docs/dist' }]
});
