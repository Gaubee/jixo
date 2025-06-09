module.exports = {
  title: 'JIXO',
  description: 'JIXO Documentation',
  base: '/jixo/',
  themeConfig: {
    nav: [
      { text: 'CLI Usage', link: '/cli/' }
    ],
    sidebar: {
      '/cli/': [
        { text: 'Introduction', link: '/cli/' },
        { text: 'Doctor', link: '/cli/doctor' },
        { text: 'Init', link: '/cli/init' },
        { text: 'Run', link: '/cli/run' },
        { text: 'Prompts', link: '/cli/prompts' }
      ]
    }
  }
};