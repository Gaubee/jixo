module.exports = {
  title: 'JIXO',
  description: 'AI-powered task orchestration tool.',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'CLI Usage', link: '/cli/' }
    ],
    sidebar: {
      '/cli/': [
        { text: 'CLI Usage', link: '/cli/' },
        { text: 'doctor', link: '/cli/doctor' },
        { text: 'init', link: '/cli/init' },
        { text: 'run', link: '/cli/run' },
		{ text: 'prompts', link: '/cli/prompts' }
      ]
    }
  }
}