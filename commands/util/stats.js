const { Command } = require('discord.js-commando')
const { stripIndents } = require('common-tags')
const moment = require('moment')
require('moment-duration-format')
module.exports = class StatsCommand extends Command {
  constructor (client) {
    super(client, {
      name: 'stats',
      group: 'util',
      memberName: 'stats',
      description: 'Displays live satistics about the bot.',
      clientPermissions: ['EMBED_LINKS'],
      throttling: {
        usages: 2,
        duration: 10
      }
    })
  }

  run (message) {
    return message.embed({
      author: { name: this.client.user.tag, icon_url: this.client.user.avatarURL() },
      title: `Client Stats.`,
      footer: { text: message.author.tag, icon_url: message.author.avatarURL() },
      thumbnail: { url: this.client.user.avatarURL() },
      timestamp: new Date(),
      fields: [
        {
          'name': '🕑 Uptime',
          'value': moment.duration(this.client.uptime).format('y [yr,] M [mth,] w [wk,] d [day,] h [hr,] m [min,] s [sec, and] S [ms]'),
          'inline': false
        },
        { 'name': '📤 Messages Sent', 'value': this.client.botStats.messagesSent, 'inline': true },
        { 'name': '📥 Messages Recieved', 'value': this.client.botStats.messagesRecieved, 'inline': true },
        { 'name': '❗ Mentions', 'value': this.client.botStats.clientMentions, 'inline': true },
        { 'name': '✏ Commands Used', 'value': this.client.botStats.commandsUsed, 'inline': true },
        { 'name': '⚔ Guilds', 'value': this.client.guilds.size, 'inline': true },
        { 'name': '📂 Channels', 'value': this.client.channels.size, 'inline': true },
        { 'name': '💻 Users', 'value': this.client.users.size, 'inline': true },
        { 'name': '💾 Memory Used', 'value': (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB', 'inline': true },
        {
          'name': '📊 Version',
          'value': stripIndents`
          **Node:** ${process.version}
          **Discord.js:** ${require('discord.js/package.json').version}
          **Discord.js-Commando:** ${require('discord.js-commando/package.json').version}`,
          'inline': true
        }
      ],
      color: 0x7289DA
    })
  }
}
