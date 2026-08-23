import { defineFilepressConfig } from 'getfilepress';

const github = 'https://github.com/Catalyst-Forge-LLC/mediatuna';

export default defineFilepressConfig({
	title: 'MediaTuna',
	description:
		'Make sure the old tapes and files can still play. Local convert to MP4 and MP3, dates kept.',
	tagline: 'Old tapes, playable files.',
	lede: 'Hard to play, hard to date, jumbled and scattered.',
	url: 'https://mediatuna.dev',
	author: 'Catalyst Forge LLC',
	logo: '/logo.png',
	ogImage: '/logo.png',
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
