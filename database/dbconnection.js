const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const dbstring = process.env.DBSTRING

const  connectDB  = async ()=>{
    try {
        console.log("connecting to db...>.✅");
        mongoose.set("strictPopulate", false);
        await mongoose.connect(dbstring,{});
        console.log("connection to db .... succesful..✅");
        
        
    } catch (error) {
        console.log("Error connecting to db....",error);
        
    }
}
module.exports = connectDB






