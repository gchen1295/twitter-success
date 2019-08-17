const mongoose = require('mongoose')

let pointsSchema = mongoose.Schema({
  serverID: String,
  userTag: String,
  userID: String,
  points: {type: Number, default: 0}
})
//new Date(+new Date() + 30*24*60*60*1000)
module.exports = mongoose.model('Points',pointsSchema)