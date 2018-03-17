/* Misc */
const { oneLine, stripIndents } = require('common-tags')
const pluralize = require('pluralize')

/* Files */
process.chdir(__dirname)
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const clientConfig = yaml.safeLoad(fs.readFileSync('./config/client.yml', 'utf8'))
const sqlConfig = yaml.safeLoad(fs.readFileSync('./config/sql.yml', 'utf8'))

/* Database */
const sqlite = require('sqlite')
const MySQL = require('mysql2/promise')
const MySQLProvider = require('discord.js-commando-mysqlprovider')

/* Commando */
const { CommandoClient, SQLiteProvider } = require('discord.js-commando')
const client = new CommandoClient({
  selfbot: false,
  commandPrefix: clientConfig.commandPrefix,
  commandEditableDuration: clientConfig.commandEditableDuration,
  nonCommandEditable: clientConfig.nonCommandEditable,
  unknownCommandResponse: clientConfig.unknownCommandResponse,
  owner: clientConfig.owner,
  invite: clientConfig.invite
})

// SQL Provider
if (sqlConfig.useMySQL === false) {
  sqlite.open(path.join(__dirname, './config/database.sqlite')).then((db) => {
    client.setProvider(new SQLiteProvider(db))
    setInterval(async () => {
      await client.provider.destroy()
      await client.provider.init(client)
      client.log.debug(`Synced Database`, client.provider.constructor.name)
    }, sqlConfig.sqlSync)
  })
} else {
  MySQL.createConnection({
    host: sqlConfig.host,
    user: sqlConfig.user,
    password: sqlConfig.password,
    database: sqlConfig.database
  }).then((db) => {
    client.setProvider(new MySQLProvider(db))
    setInterval(async () => {
      await client.provider.destroy()
      await client.provider.init(client)
      client.log.debug(`Synced Database`, client.provider.constructor.name)
    }, sqlConfig.sqlSync)
  })
}

// Auto Group Loader
var fileGroups = fs.readdirSync('./commands').filter(f => fs.statSync(path.join('./commands', f)).isDirectory())
/**
 * Converts something like `bot-staff` to `Bot Staff`.
 * @param {string} str The string you want to convert to a group name.
 * @return {string} The string after it was converted to a group name.
 */
var createGroup = str => {
  var arr = str.split('-')
  var temp = []
  arr.forEach(char => {
    char = char.charAt(0).toUpperCase() + char.slice(1)
    temp.push(char)
  })
  str = temp.join(' ')
  return str
}
var groups = []
fileGroups.forEach(group => {
  groups.push([group, createGroup(group)])
})

// Load Commands, Groups and Types
client.registry
  .registerDefaultTypes()
  .registerTypesIn(path.join(__dirname, './src/types'))
  .registerGroups(groups)
  .registerCommandsIn(path.join(__dirname, 'commands'))

/**
 * Checks to see if the file exists.
 * @param {string} source The file.
 * @return {boolean} Whether the file exists or not.
 */
const isFile = source => fs.lstatSync(source).isFile()

/**
 * Gets all files in a given directory.
 * @param {string} source The directory.
 * @return {string[]} List of the files in the directory.
 */
let getFiles = source => {
  let files = fs.readdirSync(__dirname + source).map(name => path.join(__dirname + source, name)).filter(isFile) // eslint-disable-line no-path-concat
  for (let file in files) {
    files[file] = files[file].slice(__dirname.length)
  }
  return files
}

// Load Modules  // Loading modules first so the logger can be used.
for (let file of getFiles('/modules')) {
  const moduleName = file.split('.')[0].substring(9)
  const moduleFile = require(`./${file}`)
  client[moduleName] = moduleFile
  delete require.cache[require.resolve(`./${file}`)]
}
client.log.info(oneLine`
  Initialized ${getFiles('/modules').length} ${pluralize('module', getFiles('/modules').length, false)}!
`, 'Module Initializer')

client.config = {}
// Load all configuration files to the client.
for (let file of getFiles('/config')) {
  const configFileName = file.split('.')[0].substring(8)
  if (configFileName !== 'database') {
    const configFileContents = yaml.safeLoad(fs.readFileSync(`./${file}`, 'utf8'))
    client.config[configFileName] = configFileContents
    delete require.cache[require.resolve(`./${file}`)]
  }
}

var events = []
var eventFolders = fs.readdirSync('./src/events').filter(f => fs.statSync(path.join('./src/events', f)).isDirectory())
eventFolders.forEach(folder => {
  events.push({
    type: folder,
    location: `./src/events/${folder}/`
  })
})

events.forEach(event => {
  fs.readdir(event.location, (error, files) => {
    if (error) {
      client.log.error(error, `${event.type.charAt(0).toUpperCase()}${event.type.slice(1)} Event Initializer`)
    }
    files.forEach(file => {
      var eventName = file.split('.')[0]
      var eventFile = require(`${event.location}${file}`)
      client.on(eventName, eventFile.bind(null, client))
      delete require.cache[require.resolve(`${event.location}${file}`)]
    })
    client.log.info(oneLine`
      Initialized ${files.length}
      ${event.type.charAt(0).toUpperCase()}${event.type.slice(1)}
      ${pluralize('event', files.length, false)}!
    `, `${event.type.charAt(0).toUpperCase()}${event.type.slice(1)} Event Initializer`)
  })
})

// User Blacklist
client.dispatcher.addInhibitor(message => {
  const blacklist = client.provider.get('global', 'userBlacklist', [])
  if (!blacklist.includes(message.author.id)) return false
  message.reply('you are blacklisted.')
  return 'blacklist'
})

// Lockdown
client.dispatcher.addInhibitor(message => {
  // Check in the user is an Owner.
  if (client.isOwner(message.author.id)) return false
  // Get lockdown status and reason for a possible lockdown.
  const lockdown = client.provider.get('global', 'lockdown', false)
  const reasonTemp = client.provider.get('global', 'lockdownReason', false)
  var lockdownReason
  // Return `None Specified.` if no reason is given for the lockdown.
  if (reasonTemp === false) { lockdownReason = 'None Specified.' } else { lockdownReason = reasonTemp }
  // Return lockdown status.
  if (lockdown === false) {
    return false
  } else {
    message.reply(`sorry, but the bot is currently on lockdown.\n**Reason:** ${lockdownReason}`)
    return 'lockdown'
  }
})

/* Start Assigning to Client */
client.temp = {}
// Tunnel System
client.temp.tunnels = []
// Travis Test Mode
if (process.argv[2] === '--travis-test') { client.travisTest = true } else { client.travisTest = false }

// Bot Stats
const botStats = { clientMentions: 0, commandsUsed: 0, messagesReceived: 0, messagesSent: 0 }
client.botStats = botStats
/* Stop Assigning to Client */

// Login
var token
if (client.travisTest === true) {
  token = process.env.TRAVISTOKEN
} else if (client.config.client.token) {
  token = client.config.client.token
} else {
  client.log.error('No valid token!', 'Login').then(process.exit(1))
}

client.login(token).catch(error => {
  client.log.error(stripIndents`\n
  ${client.shard ? `Shard ID: ${client.shard.id}\n` : ''}
  ${error.stack}
  `, 'Login').then(process.exit(8))
})
