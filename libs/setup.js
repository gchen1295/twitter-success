const mongoose = require('mongoose')
let Points = require('../models/points')
let Server = require('../models/servers')


async function setupServer(client, serverID, userID)
{
  try
  {
    let setupFin = false
    let found = await Server.findOne({serverID: serverID})
    let serverconfig = found ? found : {
      serverID: serverID,
      prefix: undefined,
      successChannel: undefined,
      verifiedRole: undefined,
      owner: userID,
      admins: [],
      channels: [],
      color: undefined,
      twitter:  {
        twitterID: undefined,
        consumerKey: undefined,
        consumerToken: undefined,
        accessKey: undefined,
        accessToken: undefined
      }
    }
    let currentServer = client.guilds.get(serverID)
    let serverOwner = currentServer.members.get(userID)
    serverOwner.send("Starting setup for " + currentServer.name)
    while(!setupFin)
    {
      try{
        let prefixGood = false
        let msg
        let prefix

        while(!prefixGood)
        {
          msg = await serverOwner.send("Enter bot prefix:")
          prefix = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
          prefix = prefix.first().content.trim()
          if(prefix.length === 1)
          {
            prefixGood = true
            serverconfig.prefix = prefix
          }
          else
          {
            await serverOwner.send("Prefix must be a single character.")
          }
        }
        
        msg = await serverOwner.send("Enter channels for bot to listen on as a space separated list (ex. 1234123213 21231231231 21231231231):")
        let channels = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
        serverconfig.channels = channels.first().content.trim().split(" ")
        msg = await serverOwner.send("Enter member roles as a space separated list (ex. 1234123213 21231231231 21231231231):")
        let memberRoles = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
        serverconfig.memberRoles = memberRoles.first().content.trim().split(" ")
        msg = await serverOwner.send("Enter color of embeds as integer value:")
        let color = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
        serverconfig.color = color.first().content.trim()
      }
      catch(err)
      {
        serverOwner.send({embed: {
          title: "Setup timed out!",
          color: 0xff0000,
          description: "Setup timed out! Please DM the bot ///setup to restart."
        }})
        setupFin = true
        return
      }
      
      // Check that channels exist
      let verifiedChannels = []
      let notChannels = []
      for(let c in serverconfig.channels)
      {
        let ch = currentServer.channels.get(serverconfig.channels[c])
        if(ch)
        {
          verifiedChannels.push(`<#${serverconfig.channels[c]}>`)
        }
        else
        {
          notChannels.push(serverconfig.channels[c])
        }
      }
      for(let nv in  notChannels)
      {
        let index = serverconfig.channels.indexOf(notChannels[nv])
        serverconfig.channels.splice(index, 1)
      }
      // Check that roles exist
      let verifiedRoles = []
      let notRoles = []
      for(let r in serverconfig.memberRoles)
      {
        let rh = currentServer.roles.get(serverconfig.memberRoles[r])
        if(rh)
        {
          verifiedRoles.push(rh.name)
        }
        else
        {
          notRoles.push(serverconfig.memberRoles[r])
        }
      }
      for(let nr in notRoles)
      {
        let index = serverconfig.memberRoles.indexOf(notRoles[nr])
        serverconfig.memberRoles.splice(index, 1)
      }


      if(currentServer.channels.some(cha => cha.name == 'success'))
      {
        await serverOwner.send({embed: {title: "Success channel found!", color: serverconfig.color}})
        succChannel = currentServer.channels.find(channel => channel.name === 'success')
        serverconfig.successChannel = succChannel.id
      }
      else
      {
        let sconfirm = await serverOwner.send({embed: {
          color: serverconfig.color,
          title: "No success channel found!",
          description: "React 🛠 to create one now. 📝 to add your own. ❌ to cancel."
        }})
        await sconfirm.react('🛠')
        await sconfirm.react('📝')
        await sconfirm.react('❌')
        const filt = (reaction, user) => {
          return ['🛠', '📝', '❌'].includes(reaction.emoji.name) && user.id === serverOwner.id
        }
    
        let react = await sconfirm.awaitReactions(filt, {max: 1})
        if(react.first()._emoji.name === '🛠')
        {
          let cch = await currentServer.createChannel('success',{type: 'text'})
          await serverOwner.send("Success channel created!")
          serverconfig.successChannel = cch.id
        }
        else if(react.first()._emoji.name === '📝')
        { 
          let validSuccess = false
          while(!validSuccess)
          {
            msg = await serverOwner.send("Enter success channel id:")
            let channels = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
            let proposedChannel = channels.first().content
            if(currentServer.channels.some(cha => cha.id == proposedChannel))
            {
              serverconfig.successChannel = proposedChannel
              validSuccess = true
            }
            else
            {
              await serverOwner.send("Invalid channel id!")
            }
          }
        }
        else
        {
          serverOwner.send({embed: {
            title: "Setup cancelled!",
            color: 0xff0000,
            description: "Setup cancelled. DM ~Woof~#1001 for help."
          }})
          setupFin = true
          return
        }
      }



      let emb = {
        title: "Server configuration details",
        color: serverconfig.color,
        fields: [
          {
            name: `Bot Prefix`,
            value: serverconfig.prefix == undefined ? "Not set" : serverconfig.prefix
          },
          {
            name: `Success Channel`,
            value: serverconfig.successChannel == undefined ? "None set" : `<#${serverconfig.successChannel}>`
          },
          {
            name: `Listening On Channels`,
            value: verifiedChannels.length == 0 ? "None set" : verifiedChannels.join('\n')
          },
          {
            name: `Member Roles`,
            value: verifiedRoles.length == 0 ? "None set" : verifiedRoles.join('\n')
          },
          {
            name: `Embed Color (If current embed is grey the current color code is wrong)`,
            value: serverconfig.color == undefined ? "None set" : serverconfig.color
          },
          {
            name: 'Channels Not Found',
            value: notChannels.length > 0 ? notChannels.join('\n') : "None"
          },
          {
            name: 'Roles Not Found',
            value: notRoles.length > 0 ? notRoles.join('\n') : "None"
          }
        ]
      }
      await serverOwner.send({embed: emb})
      let confirm = await serverOwner.send({embed: {
        color: serverconfig.color,
        title: "Confirm setup?",
        description: "React ✅ to confirm. React ❌ to restart."
      }})
      await confirm.react('✅')
      await confirm.react('❌')
      const filter = (reaction, user) => {
        return ['✅', '❌'].includes(reaction.emoji.name) && user.id === serverOwner.id
      }
  
      let react = await confirm.awaitReactions(filter, {max: 1})
      if(react.first()._emoji.name === '✅')
      {
        setupFin = true
        await serverOwner.send({embed: {
          color: serverconfig.color,
          title: "Please setup twitter account access!",
          thumbnail: {
            url: "https://icon-library.net/images/twitter-svg-icon/twitter-svg-icon-29.jpg"
          },
          description: "Please setup twitter account access.\n\nUse  ___///twitter___  to setup your twitter account."
        }})
        serverconfig.setupDone = true
        let s = new Server(serverconfig)
        await s.save()
      }
      else
      {
        serverOwner.send({embed: {
          color: 0xff0000,
          title: "Restarting setup!",
          description: "Restarting setup..."
        }})
      }
    }
  }
  catch(err)
  {
    console.log("Error: " + err)
  }
}

async function setupTwitter(client, userID)
{
  try
  {
    let found = await Server.findOne({owner: userID})
    if(found)
    {
      let twitt = {
        twitterID: undefined,
        consumerKey: undefined,
        consumerToken:undefined,
        accessKey: undefined,
        accessToken: undefined
      }
      let currentServer = client.guilds.get(found.serverID)
      let serverOwner = currentServer.members.get(userID)
      if(found.setupDone === false)
      {
        await serverOwner.send({embed: {
          color: 0xff0000,
          title: "Server setup not done!",
          description: "Please finish setting up server configuration first!"
        }})
        return true
      }
      await serverOwner.send("**Starting twitter setup...**")
      let isDone = false
      while(!isDone)
      {
        let msg = await serverOwner.send("Enter Twitter handle:")
        try
        {
          let handle = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
          msg = await serverOwner.send("Enter Twitter API consumer key:")
          let consumer_key = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
          msg = await serverOwner.send("Enter Twitter API consumer token:")
          let consumer_token = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
          msg = await serverOwner.send("Enter Twitter API access key:")
          let access_key = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })
          msg = await serverOwner.send("Enter Twitter API access token:")
          let access_token = await msg.channel.awaitMessages(m => m.author.id === userID, { maxMatches: 1, time: 60000, errors: ['time'] })

          twitt.twitterID = handle.first().content
          twitt.consumerKey = consumer_key.first().content
          twitt.consumerToken = consumer_token.first().content
          twitt.accessKey = access_key.first().content
          twitt.accessToken = access_token.first().content
        }
        catch(err)
        {
          serverOwner.send({embed: {
            color: 0xff0000,
            title: "Timed Out!",
            description: "Setup timed out. Please try again."
          }})
          return true
        }
        await serverOwner.send({embed: {
          color: found.color,
          title: "Twitter Configuration Details",
          description: "Please ensure the following is correct! DM ~Woof~#1001 for help setting up.",
          fields: [
            {
              name: "Twitter Account Handle",
              value: twitt.twitterID
            },
            {
              name: "Twitter Consumer Key",
              value: twitt.consumerKey
            },
            {
              name: "Twitter Consumer Token",
              value: twitt.consumerToken
            },
            {
              name: "Twitter Access Key",
              value: twitt.accessKey
            },
            {
              name: "Twitter Access Token",
              value: twitt.accessToken
            }
          ]
        }})
        let msg2 = await serverOwner.send({embed: {
          color: found.color,
          title: "Confirm setup?",
          description: "React ✅ to confirm and ❌ to restart."
        }})
        await msg2.react('✅')
        await msg2.react('❌')
        const filter = (reaction, user) => {
          return ['✅', '❌'].includes(reaction.emoji.name) && user.id === serverOwner.id
        }
        let reacts = await msg2.awaitReactions(filter, {max: 1})
        if(reacts.first()._emoji.name === '✅')
        {
          found.twitter = twitt
          await found.save()
          await serverOwner.send({embed: {
            color: found.color,
            title: "Twitter setup!",
            description: "Your twitter details have successfully been set."
          }})
          return true
        }
      }
    }
    else
    {
      return false
    }
  }
  catch(err)
  {
    console.log(err)
    return false
  }
}

async function createSetup(client, serverID, userID)
{
  try
  {
    let found = await Server.findOne({serverID: serverID})
    let serverconfig = found ? found : {
      serverID: serverID,
      prefix: undefined,
      successChannel: undefined,
      verifiedRole: undefined,
      owner: userID,
      admins: [],
      channels: [],
      color: undefined,
      activeSub: true,
      twitter:  {
        twitterID: undefined,
        consumerKey: undefined,
        consumerToken: undefined,
        accessKey: undefined,
        accessToken: undefined
      }
    }
    let currentServer = client.guilds.get(serverID)
    let serverOwner = currentServer.members.get(userID)
    serverOwner.send({embed: {
      color: 0x00ff00,
      title: "Client Added!",
      description: "You may now setup the bot using ___///setup___"
    }})
    let newServer = Server(serverconfig)
    await newServer.save()
    return true
  }
  catch(err)
  {
    console.log(err)
    return false
  }
}

module.exports = {
  'setupServer': setupServer,
  'setupTwitter': setupTwitter,
  'createSetup': createSetup
}