const mongoose = require('mongoose')

let serverSchema = mongoose.Schema({
  serverID: {type: String, default: undefined},
  prefix: {type: String, default: undefined},
  successChannel: {type: String, default: undefined},
  memberRoles: [String],
  owner: {type: String, default: undefined},
  admins: [String],
  channels: [String],
  color: {type: Number, default: undefined},
  twitter: {
    twitterID: {type: String, default: undefined},
    consumerKey: {type: String, default: undefined},
    consumerToken: {type: String, default: undefined},
    accessKey: {type: String, default: undefined},
    accessToken: {type: String, default: undefined}
  },
  setupDone: {type: Boolean, default: false},
  activeSub: {type: Boolean, default: false}
})
//new Date(+new Date() + 30*24*60*60*1000)
module.exports = mongoose.model('Server',serverSchema)