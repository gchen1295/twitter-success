require('dotenv').config()
var Twitter = require('twitter')
const request = require('request').defaults({
  encoding: null
})
const discord = require('discord.js')
const client = new discord.Client();
const mongoose = require('mongoose')
let Points = require('./models/points')
let Server = require('./models/servers')
const setup = require('./libs/setup.js')

const mongoserver = process.env.MONGO_SERVER
const db = process.env.MONGO_DB
let appowner

async function addPoints(serverID, userID, userTag, points)
{
  try
  {
    let found = await Points.findOne({userID: userID, serverID: serverID})
    if(found)
    {
      found.points += points
      await found.save()
      return true
    }
    else
    {
      
      let n = new Points({ serverID: serverID, userID: userID, userTag: userTag, points: points})
      await n.save()
      return true
    }
  }catch(err)
  {
    console.log(err)
    return false
  }
}

async function resetPoints(serverID)
{
  try
  {
    let removed = await Points.deleteMany({serverID: serverID}).exec()
    return removed.deletedCount
  }
  catch(err)
  {
    console.log(err)
    return undefined
  }
}

async function deductPoints(serverID, userID, userTag, points)
{
  try
  {
    let found = await Points.findOne({userID: userID, serverID: serverID})
    if(found)
    {
      found.points -= points
      found.points = found.points < 0 ? 0 : found.points
      await found.save()
      return true
    }
    else
    {
      let n = new Points({ serverID: serverID, userID: userID, userTag: userTag, points: points})
      await n.save()
      return true
    }
  }catch(err)
  {
    return false
  }
}

async function getPoints(serverID, userID)
{
  try
  {
    let found = await Points.findOne({serverID: serverID, userID: userID})
    if(found)
    {
      return found
    }
    else
    {
      return undefined
    }
  }
  catch(err)
  {
    return undefined
  }
}

async function setupCheck()
{
  let notSetup = []
  await Promise.all(client.guilds.map(async guild => {
    let found = await Server.findOne({serverID: guild.id})
    if(found)
    {
      if(found.setupDone)
      {

      }
      else
      {
        let s = `${guild.name} | ${guild.id}`
        notSetup.push(s)
      }
    }
    else
    {
      let s = `${guild.name} | ${guild.id}`
      notSetup.push(s)
    }
  }))
  return notSetup
}

async function getServers()
{
  let servers = []
  await Promise.all(client.guilds.map(async guild => {
    let found = await Server.findOne({serverID: guild.id})
    if(found)
    {
      if(found.setupDone)
      {
        if(found.activeSub === true)
        {
          let s = `${guild.name} | ${guild.id} | Active Sub`
          servers.push(s)
        }
        else
        {
          let s = `${guild.name} | ${guild.id} | Paused Sub`
          servers.push(s)
        }
        
      }
      else
      {
        let s = `${guild.name} | ${guild.id} | Needs Setup`
        servers.push(s)
      }
    }
    else
    {
      let s = `${guild.name} | ${guild.id} | Not Active`
      servers.push(s)
    }
  }))
  return servers
}

async function firstStart()
{
  // Check database for a collection
  let s = await Server.findOne({serverID: process.env.MAIN_SERVER})
  if(s)
  {
    return
  }
  else
  {
    let firstSetup = new Server({serverID: process.env.MAIN_SERVER, owner: appowner.id})
    await firstSetup.save()
  }
}

client.login(process.env.BOT_TOKEN).then(() => {
  console.log("Logged in")
  mongoose.connect(`mongodb://${mongoserver}/${db}`, {
    useNewUrlParser: true
  }, async function(err, cl){
    if(err) console.log(err)
    console.log("Mongo connected")
    let appl = await client.fetchApplication()
    appowner = appl.owner
    // await firstStart()
    let s = await setupCheck()
    if(s.length > 0)
    {
      let emb = {
        color: 0xff0000,
        title: "Servers need setting up!",
        description: s.join('\n')
      }
      let owner = client.guilds.get(process.env.MAIN_SERVER).members.get(appowner.id)
      owner.send({embed: emb})
    }
  })
})

client.on('message', async (message) => {
  if (message.author.bot) return
  let allServers = await Server.find({})
  let isAdmin = message.author.id === appowner.id ? true : false
  let guild
  let currServer

  let isSuccess = allServers.filter((server)=>{
    if(message.channel.id === server.successChannel) currServer = server
    return message.channel.id === server.successChannel
  })
  if (isSuccess.length > 0) {
    // Find our server
    // Create our twitter object
    // Use it to post something
    if (message.attachments.size > 0) {
      message.attachments.forEach(att => {
        let url = att.url.toLowerCase()
        if (url.includes('.png', url.length - 4) || url.includes('.jpg', url.length - 4)) {
          request.get(att.url, (err, response, body) => {
            if (!err && response.statusCode == 200) {
              let data = Buffer.from(body).toString('base64');
              // Create our twitter object for server here
              let twittClient = new Twitter({
                consumer_key: currServer.twitter.consumerKey,
                consumer_secret: currServer.twitter.consumerToken,
                access_token_key: currServer.twitter.accessKey,
                access_token_secret: currServer.twitter.accessToken
              });

              twittClient.post('media/upload', {
                media_data: data
              }, function (error, tweet, response) {
                if (error) throw error;
                console.log("Tweet posted by " + message.author.tag); // Tweet body.
                twittClient.post('statuses/update', {
                  status: `Success by ${message.author.tag}`,
                  media_ids: tweet.media_id_string
                }, async function (error, tweet, response) {
                  if (error) throw error;
                  let emb = {
                    title: "Success Posted ",
                    color: 0xffa500,
                    description: `[View tweet](https://twitter.com/${currServer.twitter.twitterID}/status/${tweet.id_str})\n\nClick \uD83D\uDDD1 to delete`
                  }
                  let msg = await message.channel.send({
                    embed: emb
                  })
                  await msg.react("\uD83D\uDDD1")
                  const filter = (reaction, user) => {
                    return ['\uD83D\uDDD1'].includes(reaction.emoji.name) && user.id === message.author.id;
                  }
                  //Add points to user here
                  await addPoints(currServer.id, message.author.id, 1)

                  msg.awaitReactions(filter, {
                    max: 1
                  }).then(async collected => {
                    twittClient.post(`/statuses/destroy/${tweet.id_str}.json`, {
                      id: tweet.id_str
                    }, (error, tweet, response) => {
                      if (error)
                      {
                        console.log(error)
                        emb = {
                          title: "Deleted Tweet",
                          color: 0xffa500,
                          description: "Tweet deleted!"
                        }
                        msg.edit({
                          embed: emb
                        })
                      }
                      emb = {
                        title: "Deleted Tweet",
                        color: 0xffa500,
                        description: "Tweet deleted!"
                      }
                      msg.edit({
                        embed: emb
                      })
                    })

                    await deductPoints(currServer.id, message.author.id, 1)
                  })
                });
              });
            }
          })
        }
      })
    }
  }
  ///
  /// Check for approriate permissions and sets current guild
  ///

  if(message.channel.type === 'dm')
  {
    for(let i in allServers)
    {
      for(let j in allServers[i].admins)
      {
        if(message.author.id === allServers[i].admins[j]) // Check if author is admin and
        {
          currServer = allServers[i]
          guild = client.guilds.get(allServers[i].serverID)
          isAdmin = true
          break
        }
      }
      if(allServers[i].owner === message.author.id)
      {
        guild = client.guilds.get(allServers[i].serverID)
        isAdmin = true
        currServer = allServers[i]
        break
      }
    }
  }
  else
  {
    currServer = await Server.findOne({serverID: message.guild.id})
  }
  if(currServer)
  {
    if(currServer.admins.includes(message.author.id))
    {
      guild = client.guilds.get(currServer.serverID)
      isAdmin = true
    }
    if(currServer.owner === message.author.id)
    {
      guild = client.guilds.get(currServer.serverID)
      isAdmin = true
    }
    if(appowner.id === message.author.id)
    {
      guild = client.guilds.get(currServer.serverID)
      isAdmin = true
    }
  }
  else
  {
    if(message.author.id === appowner.id)
    {
      currServer = {
        prefix: 't//',
        color: 8516884,
        owner: appowner.id,
        memberRoles: [],
        admins: [],
        channels: [message.channel.id],
        serverID: message.guild ? message.guild.id : '',
      }
    }
    else
    {
      return
    }
  }
  // if(allServers)
  // {
  //   for(let i in allServers)
  //   {
  //     for(let j in allServers[i].admins)
  //     {
  //       if(message.author.id === allServers[i].admins[j]) // Check if author is admin and
  //       {
  //         currServer = allServers[i]
  //         guild = client.guilds.get(allServers[i].serverID)
  //         isAdmin = true
  //         break
  //       }
  //     }
  //     if(allServers[i].owner === message.author.id)
  //     {
  //       guild = client.guilds.get(allServers[i].serverID)
  //       isAdmin = true
  //       currServer = allServers[i]
  //       break
  //     }
  //   }
  // }
  // else
  // {
  //   return
  // }
  let isChannel = allServers.filter((server)=>{
    if(message.channel.type !== 'dm')
    {
      if(server.serverID == message.guild.id) currServer = server
    }
    for(let i in server.channels)
    {
      return message.channel.id === server.channels[i]
    }
  })
  let args = message.content.split(' ')
  
  if(currServer.prefix === undefined)
  {
    // if(message.author.id === currServer.owner || message.author.id === appowner.id)
    // {
    //   message.channel.send({embed: {
    //     title: "No Prefix Set!",
    //     description: `No prefix is set for this server! For help DM ${appowner.tag}`,
    //     color: currServer.color == undefined ? 0x000000 : currServer.color
    //   }})
    // }
    return
  }
  if(args[0].substr(0, currServer.prefix.length) !== currServer.prefix)
  {
    return
  }

  let cmd = args[0].substr(currServer.prefix.length ,  args[0].length)
  if(isChannel.length > 0 || message.channel.type == 'dm')
  {
    // Regular commands here
    ///
    /// Help message
    if(cmd === 'help')
    {
      if(message.author.id === appowner.id)
      {
        message.channel.send({embed: {
          title: "Administrative Commands",
          description: `For help DM ${appowner.tag}`,
          color: currServer.color == undefined ? 0x000000 : currServer.color,
          fields: [
            {
              name: "t//setup-create <guildID> <ownerID>",
              value: "Creates subscription for guild and sends DM to corresponding user."
            },
            {
              name: "t//listServers",
              value: "List current servers the bot is working on."
            }
          ]
        }})
      }
      if(isAdmin)
      {
        message.channel.send({embed: {
          title: "Administrative Commands",
          description: `For help DM ${appowner.tag}`,
          color: currServer.color == undefined ? 0x000000 : currServer.color,
          fields: [
            {
              name: "setup",
              value: "Inital bot configuration"
            },
            {
              name: "twitter",
              value: "Twitter application setup"
            },
            {
              name: "editSuccess <channelID>",
              value: "Changes success channel for the server"
            },
            {
              name: "color <integer>",
              value: "Takes an integer color value for embed border"
            },
            {
              name: "info",
              value: "Twitter application setup"
            },
            {
              name: "listChannels",
              value: "List channels bot is listening on"
            },
            {
              name: "addChannels <channelID> <channelID> ....",
              value: "Add channels for bot to listen on. (Space separate list)"
            },
            {
              name: "removeChannels <channelID> <channelID> ....",
              value: "Removes channels from bot. (Space separate list)"
            },
            {
              name: "listAdmins",
              value: "List admins"
            },
            {
              name: "addAdmins <userID> <userID> ....",
              value: "Add admins. (Space separate list)"
            },
            {
              name: "removeAdmins <userID> <userID> ....",
              value: "Removes admins. (Space separate list)"
            },
          ]
        }})
        message.channel.send({embed: {
          title: "Points Commands",
          description: `For help DM ${appowner.tag}`,
          color: currServer.color == undefined ? 0x000000 : currServer.color,
          fields: [
            {
              name: "points",
              value: "Shows accumulated points for user"
            },
            {
              name: "getPoints <userID>",
              value: "Shows points for provided user"
            },
            {
              name: "add <userID> <amount>",
              value: "Adds points to user"
            },
            {
              name: "deduct <userID> <amount>",
              value: "Deducts points from user"
            },
            {
              name: "reset",
              value: "Resets points for server"
            }
          ]
        }})
      }
      else
      {
        message.channel.send({embed: {
          title: "Points Commands",
          description: `For help DM ${appowner.tag}`,
          color: currServer.color == undefined ? 0x000000 : currServer.color,
          fields: [
            {
              name: "points",
              value: "Shows accumulated points"
            }
          ]
        }})
      }
    }
  }

  if(cmd === 'add' && isAdmin && (isChannel.length > 0 || message.channel.type == 'dm'))
  {
    let userID = args[1]
    let user = guild.members.get(userID)
    if(user)
    {
      user = user.user
      let userTag = user.tag
      let points = parseInt(args[2])
      if(userTag)
      {
        if(isNaN(points)){
          let emb = 
          {
            color: 0xff0000,
            title: "Invalid number of points!"
          }
          message.author.send({embed: emb})
        }
        else
        {
          await addPoints(currServer.id, userID, userTag, points)
          let emb = 
          {
            color: currServer.color,
            title: `${points} points added to ${userTag}`
          }
          message.author.send({embed: emb})
        } 
      }
    }
    else
    {
      message.channel.send({embed: {
        color: 0xff0000,
        title: "User not found.",
        description: `No user found for ${userID}`
      }})
    }
  }

  if(cmd === 'reset' && isAdmin && (isChannel.length > 0))
  {
    let m1 = await message.channel.send({embed: {
      color: 0xff0000,
      title: "Are you sure you want to reset all points for the server?"
    }})
    await m1.react('✅')
    await m1.react('❌')

    const filter = (react, user) => {
      return ['✅', '❌'].includes(react.emoji.name) && user.id === message.author.id
    }
    let react = await m1.awaitReactions(filter, {max: 1})
    if(react.first()._emoji.name === '✅')
    {
      m1 = await message.channel.send({embed: {
        color: 0xff0000,
        title: "Please confirm once more."
      }})
      await m1.react('✅')
      await m1.react('❌')
  
      const filter = (react, user) => {
        return ['✅', '❌'].includes(react.emoji.name) && user.id === message.author.id
      }
      react = await m1.awaitReactions(filter, {max: 1})
      if(react.first()._emoji.name === '✅')
      {
        let dc = await resetPoints(currServer.id)
        if(dc){
          await message.channel.send({embed: {
            color: currServer.color,
            title: `Points have been reset!`,
            description: `Reset points for ${dc} users.`
          }})
        }
        else
        {
          await message.channel.send({embed: {
            color: 0xff0000,
            title: `Problem resetting points!`
          }})
        }
      }
    }
  }

  if(cmd === 'deduct' && isAdmin && (isChannel.length > 0 || message.channel.type == 'dm'))
  {
    let userID = args[1]
    let user = guild.members.get(userID).user
    if(user)
    {
      let userTag = user.tag
      let points = parseInt(args[2])
      if(userTag)
      {
        if(isNaN(points)){
          let emb = 
          {
            color: currServer.color,
            title: "Invalid number of points!"
          }
          message.author.send({embed: emb})
        }
        else
        {
          await deductPoints(currServer.id, userID, userTag, points)
          let emb = 
          {
            color: currServer.color,
            title: `${points} points deducted from ${userTag}`
          }
          message.author.send({embed: emb})
        }
      }
    }
    else
    {
      message.channel.send({embed: {
        color: 0xff0000,
        title: "User not found.",
        description: `No user found for ${userID}`
      }})
    }
  }
  if(cmd === 'points' && (isChannel.length > 0 || message.channel.type == 'dm'))
  {
    let userPoints = await getPoints(currServer.id, message.author.id)
    if(userPoints)
    {
      message.channel.send({embed:{
        color: currServer.color,
        title: `Points: ${userPoints.points}`
      }})
    }
    else
    {
      let serverOwner = guild.members.get(currServer.owner)
      message.channel.send({embed:{
        color: 0xff0000,
        title: `User not found in database. Please contact ${serverOwner.user.tag}`
      }})
    }
  }

  if(cmd === 'getPoints' && isAdmin && (isChannel.length > 0 || message.channel.type == 'dm'))
  {
    let userPoints = await getPoints(currServer.id, args[1])
    if(userPoints)
    {
      let quser = guild.members.get(args[1])
      message.channel.send({embed:{
        color: currServer.color,
        title: `Points for ${quser.user.tag}: ${userPoints.points}`
      }})
    }
    else
    {
      let serverOwner = guild.members.get(currServer.owner)
      message.channel.send({embed:{
        color: 0xff0000,
        title: `User not found in database. Please contact ${serverOwner.user.tag}`
      }})
    }
  }


    ///
    /// EDITING COMMANDS
    ///
    /// Edit success channel
    if(cmd === "editSuccess" && isAdmin)
    {
      if(guild.channels.some(cha => cha.id == args[1]))
      {
        currServer.successChannel = args[1]
        await currServer.save()
        message.author.send({embed:{
          color: 8516884,
          title: "Success Channel Changed!",
          description: `Success channel for ${guild.name} has been changed to <#${args[1]}>`
        }})
      }
      else
      {
        message.author.send({embed:{
          color: 0xff0000,
          title: "Success Channel Invalid!",
          description: `Provided channel id was not a valid channel in ${guild.name}.`
        }})
      }
    }
    ///
    /// Resume setup
    if(cmd === "setup")
    {
      let serverID
      let color
      for(let i in allServers)
      {
        if(allServers[i].owner === message.author.id)
        {
          if(!allServers[i].setupDone)
          {
            serverID = allServers[i].serverID
          }
          color = allServers[i].color
        }
      }
      if(serverID)
      {
        await setup.setupServer(client, serverID, message.author.id)
      }
      else
      {
        message.author.send({embed:{
          color: color,
          title: "Not activated!",
          description: `You do not have a permission to use this function! Please contact ${appowner.tag} for further details!`
        }})
      }
    }
    ///
    /// Twitter setup
    if(cmd === "twitter" && isAdmin)
    {
      let stat = await setup.setupTwitter(client, message.author.id)
      if(!stat)
      {
        message.author.send({embed: {
          color: 0xff0000,
          title: "Error setting up twitter account!",
          description: `There was an error setting up your twitter account. Please DM ${appowner.tag} for help or try again.`
        }})
      }
    }
    ///
    /// Create setup for client
    if(cmd === "setup-create" && message.author.id === appowner.id)
    {
      let foundGuild = client.guilds.get(args[1])
      if(foundGuild)
      {
        let foundUser = foundGuild.members.get(args[2])
        if(foundUser)
        {
          await setup.createSetup(client, args[1], args[2])
        }
        else
        {
          message.author.send({embed: {
            color: 0xff000,
            title: "Error finding user!"
          }})
        }
      }
      else
      {
        message.author.send({embed: {
          color: 0xff000,
          title: "Error finding guild!"
        }})
      }
    }
    ///
    /// Removes a client
    if(cmd === "removeServer" && message.author.id === appowner.id)
    {
      let toRemove = await Server.findOne({serverID: args[1]})
      
      if(toRemove)
      {
        let trInfo = client.guilds.get(toRemove.serverID)
        let m1 = await message.channel.send({embed: {
          color: 0xff0000,
          title: `Confirm server removal`,
          description: `Are you sure you want to remove ${trInfo.name} | ${toRemove.serverID}?`
        }})
        await m1.react('✅')
        await m1.react('❌')
    
        const filter = (react, user) => {
          return ['✅', '❌'].includes(react.emoji.name) && user.id === message.author.id
        }
        let react = await m1.awaitReactions(filter, {max: 1})
        if(react.first()._emoji.name === '✅')
        {
          m1 = await message.channel.send({embed: {
            color: 0xff0000,
            title: "Please confirm once more."
          }})
          await m1.react('✅')
          await m1.react('❌')
      
          const filter = (react, user) => {
            return ['✅', '❌'].includes(react.emoji.name) && user.id === message.author.id
          }
          react = await m1.awaitReactions(filter, {max: 1})
          if(react.first()._emoji.name === '✅')
          {
            let dc = await setup.removeServer(args[1])
            if(dc){
              await message.channel.send({embed: {
                color: currServer.color,
                title: `Server Removed`,
                description: `${trInfo.name} has been removed from subscribers`
              }})
            }
            else
            {
              await message.channel.send({embed: {
                color: 0xff0000,
                title: `Problem removing server!`
              }})
            }
          }
        }
        else
        {
          await message.channel.send('Cancelled.')
        }
      }
      else
      {
        await message.channel.send({embed: {
          color: 0xff0000,
          title: "Server not found!"
        }})
      }
    }
    ///
    /// Lists all servers the bot is currently on
    if(cmd === "listServers" && message.author.id === appowner.id)
    {
      let notSet = await setupCheck();
      let serverList = await getServers();
      if(serverList.length > 0)
      {
        message.author.send({embed: {
          title: "Servers List",
          color: 16753920,
          description: serverList.join('\n')
        }})
      }
      else
      {
        message.author.send({embed: {
          title: "Servers List",
          color: 0xff0000,
          description: "No servers found!"
        }})
      }
    }
    ///
    /// Lists all admins of current server
    if(cmd === "listAdmins")
    {
      if(message.author.id == appowner.id)
      {
        if(args.length > 1)
        {
          // Grabs admin of provided serverID
          let foundServer = await Server.findOne({serverID: args[1]})
          if(foundServer)
          {
            let setGuild = await client.guilds.get(args[1])
            let foundUsers = []
            for(let i in foundServer.admins)
            {
              let cm = await setGuild.members.get(foundServer.admins[i])
              if(cm)
              {
                foundUsers.push(`${cm.user.tag} | ${cm.id}`)
              }
            }
            if(foundUsers.length > 0)
            {
              message.author.send({embed: {
                color: foundServer.color,
                title: "Admins List",
                description: foundUsers.join('\n')
              }})
            }
            else{
              await message.author.send({embed: {color: 0xff0000, title: "No admins."}})
            }
          }
          else
          {
            await message.author.send({embed: {color: 0xff0000, title: "Invalid server provided."}})
          }
        }
        else
        {
          let foundUsers = []
          for(let i in currServer.admins)
          {
            let cm = await guild.members.get(currServer.admins[i])
            if(cm)
            {
              foundUsers.push(`${cm.user.tag} | ${cm.id}`)
            }
          }
          if(foundUsers.length > 0)
          {
            message.author.send({embed: {
              color: currServer.color,
              title: "Admins List",
              description: foundUsers.join('\n')
            }})
          }
          else{
            await message.author.send({embed: {color: 0xff0000, title: "No admins."}})
          }
        }
      }
      else if(message.author.id === currServer.owner)
      {
        let foundUsers = []
        for(let i in currServer.admins)
        {
          let cm = await guild.members.get(currServer.admins[i])
          if(cm)
          {
            foundUsers.push(`${cm.user.tag} | ${cm.id}`)
          }
        }
        if(foundUsers.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Admins List",
            description: foundUsers.join('\n')
          }})
        }
        else{
          await message.author.send({embed: {color: 0xff0000, title: "No admins."}})
        }
    }
    }
    ///
    /// Adds admin to server
    if(cmd === "addAdmins")
    {
      if(message.author.id === currServer.owner)
      {
        // Grabs admin of server the current user is admin or owner of
        let foundUsers = []
        for(let i = 1; i < args.length; ++i)
        {
          let cm = await guild.members.get(args[i])
          if(cm && !currServer.admins.includes(cm.id))
          {
            currServer.admins.push(args[i])
            foundUsers.push(`${cm.user.tag} | ${cm.id}`)
          }
        }
        if(foundUsers.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Admins Added!",
            description: foundUsers.join('\n')
          }})
          await currServer.save()
        }
        else{
          message.author.send({embed: {color: 0xff0000, title: "No valid admins provided!"}})
        }
      }
    }
    ///
    /// Removes admin to server
    if(cmd === "removeAdmins")
    {
      if(message.author.id == currServer.owner)
      {
        let foundUsers = []
        for(let i = 1; i < args.length; ++i)
        {
          if(currServer.admins.includes(args[i]))
          {
            let cm = await guild.members.get(args[i])
            let ut = cm === undefined ? "Not Found" : cm.user.tag
            currServer.admins.splice(currServer.admins.indexOf(args[i]), 1)
            foundUsers.push(`${ut} | ${args[i]}`)
          }
        }
        if(foundUsers.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Admins Removed!",
            description: foundUsers.join('\n')
          }})
          await currServer.save()
        }
        else{
          message.author.send({embed: {color: 0xff0000, title: "No valid admins provided!"}})
        }
      }
    }
    ///
    /// Lists all channels of current server
    if(cmd === "listChannels")
    {
      if(message.author.id == appowner.id || isAdmin)
      {
        if(args.length > 1)
        {
          // Grabs admin of provided serverID
          let foundServer = await Server.findOne({serverID: args[1]})
          if(foundServer)
          {
            let setGuild = await client.guilds.get(args[1])
            let foundChannels = []
            for(let i in foundServer.channels)
            {
              let cm = await setGuild.members.get(foundServer.channels[i])
              if(cm)
              {
                foundChannels.push(`${cm.user.tag} | ${cm.id}`)
              }
            }
            if(foundChannels.length > 0)
            {
              message.author.send({embed: {
                color: foundServer.color,
                title: "Channel List",
                description: foundChannels.join('\n')
              }})
            }
            else{
              await message.author.send({embed: {color: 0xff0000, title: "No channels."}})
            }
          }
          else
          {
            await message.author.send({embed: {color: 0xff0000, title: "Invalid server provided."}})
          }
        }
        else
        {
          let foundChannels = []
          for(let i in currServer.channels)
          {
            let cm = await guild.members.get(currServer.channels[i])
            if(cm)
            {
              foundChannels.push(`${cm.user.tag} | ${cm.id}`)
            }
          }
          if(foundChannels.length > 0)
          {
            message.author.send({embed: {
              color: currServer.color,
              title: "Channels List",
              description: foundChannels.join('\n')
            }})
          }
          else{
            await message.author.send({embed: {color: 0xff0000, title: "No channels."}})
          }
        }
      }
      else if(message.author.id === currServer.owner)
      {
        let foundChannels = []
        for(let i in currServer.channels)
        {
          let cm = await guild.members.get(currServer.channels[i])
          if(cm)
          {
            foundChannels.push(`${cm.user.tag} | ${cm.id}`)
          }
        }
        if(foundChannels.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Channels List",
            description: foundChannels.join('\n')
          }})
        }
        else{
          await message.author.send({embed: {color: 0xff0000, title: "No channels."}})
        }
      }
    }
    ///
    /// Add channels to server
    if(cmd === "addChannels")
    {
      if(message.author.id === currServer.owner || isAdmin)
      {
        // Grabs admin of server the current user is admin or owner of
        let foundChannels = []
        for(let i = 1; i < args.length; ++i)
        {
          let cm = await guild.channels.get(args[i])
          if(cm && !currServer.channels.includes(cm.id))
          {
            currServer.channels.push(args[i])
            foundChannels.push(`<#${cm.id}>`)
          }
        }
        if(foundChannels.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Channels Added!",
            description: foundChannels.join('\n')
          }})
          await currServer.save()
        }
        else{
          message.author.send({embed: {color: 0xff0000, title: "No valid channels provided!"}})
        }
      }
    }
    ///
    /// Removes channels from server
    if(cmd === "removeChannels")
    {
      if(message.author.id == currServer.owner || isAdmin)
      {
        let foundChannels = []
        for(let i = 1; i < args.length; ++i)
        {
          if(currServer.channels.includes(args[i]))
          {
            let cm = await guild.channels.get(args[i])
            let ut = cm === undefined ? "Not Found" : `<#${cm.id}>`
            currServer.channels.splice(currServer.channels.indexOf(args[i]), 1)
            foundChannels.push(`${ut}`)
          }
        }
        if(foundChannels.length > 0)
        {
          message.author.send({embed: {
            color: currServer.color,
            title: "Channels Removed!",
            description: foundChannels.join('\n')
          }})
          await currServer.save()
        }
        else{
          message.author.send({embed: {color: 0xff0000, title: "No valid channels provided!"}})
        }
      }
    }
    ///
    /// Edits embed color
    if(cmd === "color")
    {
      if(message.author.id == currServer.owner || isAdmin)
      {
        if(args.length < 2)
        {
          message.author.send({embed: {
            title: "Please provide a color",
            color: 0xff0000
          }})
        }
        else
        {
          currServer.color = args[1]
          message.author.send({embed: {
            title: "Color set!",
            color: args[1],
            description: "Color has been set. If the current embed color is wrong then the color code provided is not valid."
          }})
        }
      }
    }
    ///
    /// Check server information
    if(cmd === "info" && isAdmin)
    {
      let server = await Server.findOne({$or: [{owner: message.author.id}, {admins: message.author.id}]})
      if(server)
      {
        let listening = []
        let roles = []
        for(let r in server.memberRoles)
        {
          let rh = guild.roles.get(server.memberRoles[r])
          if(rh)
          {
            roles.push(rh.name)
          }
        }
        for(let i in server.channels)
        {
          listening.push(`<#${server.channels[i]}>`)
        }
        await message.author.send({embed: {
          color: server.color,
          title: "Server Configuration",
          fields: [
            {
              name: "Bot Prefix",
              value: server.prefix == undefined ? "No prefix set" : server.prefix
            },
            {
              name: "Success Channel",
              value: server.successChannel === undefined ? "Success channel not found" : `<#${server.successChannel}>`
            },
            {
              name: "Listening On Channels",
              value: listening.length > 0 ? listening.join('\n') : "No channels set"
            },
            {
              name: "Embed Color",
              value: server.color == undefined ? "No color set" : server.color
            }
          ]
        }})
        await message.author.send({embed: {
          color: server.color,
          title: "Twitter Configuration",
          fields: [
            {
              name: "Twitter Account Handle",
              value: server.twitter.twitterID == undefined ? "Not set!" : server.twitter.twitterID
            },
            {
              name: "Twitter Consumer Key",
              value: server.twitter.consumerKey == undefined ? "Not set!" :server.twitter.consumerKey
            },
            {
              name: "Twitter Consumer Token",
              value: server.twitter.consumerToken == undefined ? "Not set!" : server.twitter.consumerToken
            },
            {
              name: "Twitter Access Key",
              value: server.twitter.accessKey == undefined ? "Not set!" : server.twitter.accessKey
            },
            {
              name: "Twitter Access Token",
              value: server.twitter.accessToken == undefined ? "Not set!" : server.twitter.accessToken
            }
          ]
        }})
      }
    }
    
    ///
    /// Check server information
    if(cmd === "getInfo" && message.author.id === appowner.id)
    {
      let server = await Server.findOne({serverID: args[1]})
      if(server)
      {
        let listening = []
        let roles = []
        for(let r in server.memberRoles)
        {
          let rh = guild.roles.get(server.memberRoles[r])
          if(rh)
          {
            roles.push(rh.name)
          }
        }
        for(let i in server.channels)
        {
          listening.push(`<#${server.channels[i]}>`)
        }
        await message.author.send({embed: {
          color: server.color,
          title: "Server Configuration",
          fields: [
            {
              name: "Bot Prefix",
              value: server.prefix == undefined ? "No prefix set" : server.prefix
            },
            {
              name: "Success Channel",
              value: server.successChannel === undefined ? "Success channel not found" : `<#${server.successChannel}>`
            },
            {
              name: "Listening On Channels",
              value: listening.length > 0 ? listening.join('\n') : "No channels set"
            },
            {
              name: "Member Roles",
              value: roles.length > 0 ? roles.join('\n') : 'No roles set'
            },
            {
              name: "Embed Color",
              value: server.color == undefined ? "No color set" : server.color
            }
          ]
        }})
        await message.author.send({embed: {
          color: server.color,
          title: "Twitter Configuration",
          fields: [
            {
              name: "Twitter Account Handle",
              value: server.twitter.twitterID == undefined ? "Not set!" : server.twitter.twitterID
            },
            {
              name: "Twitter Consumer Key",
              value: server.twitter.consumerKey == undefined ? "Not set!" :server.twitter.consumerKey
            },
            {
              name: "Twitter Consumer Token",
              value: server.twitter.consumerToken == undefined ? "Not set!" : server.twitter.consumerToken
            },
            {
              name: "Twitter Access Key",
              value: server.twitter.accessKey == undefined ? "Not set!" : server.twitter.accessKey
            },
            {
              name: "Twitter Access Token",
              value: server.twitter.accessToken == undefined ? "Not set!" : server.twitter.accessToken
            }
          ]
        }})
      }
      else
      {
        await message.author.send({embed: {
          color: 0xff0000,
          title: "Server Not Found!",
        }})
      }
  }
})
