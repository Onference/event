import 'dotenv/config'
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import {sendRegistrationEmail,sendReminderEmail} from './sendEmail.js'
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT 
const appName=process.env.APP_NAME
const dbName=process.env.DB_NAME
const uri=process.env.MONGO_URI

app.use(cors({
  origin: process.env.FRONTEND.split(','),
  credentials: true
}));
app.use(express.json());

async function connectDB() {
  try {
    await mongoose.connect(uri, {
      appName,
      dbName
    });
    console.log("DB Connection Successfull");
  } catch (err) {
    console.error("DB Connection Failed", err.message);
  }
}

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true
  },
  fullname: {
    type: String,
    trim: true
  },
  mobileno: {
    type: String,
    trim: true
  }
},
  {
    timestamps: true,
    strict: false
  }
);

const User = mongoose.models.User || mongoose.model("User", userSchema, "User");

const activitySchema = new mongoose.Schema({
  user: {type:mongoose.Schema.Types.ObjectId,ref:'User'},
  firstLogin: { type: String },
  lastLogin: { type: String },
  auditorium: [ { inTime: { type: String }, outTime: { type: String } } ],
  stalls: [
  {
    stall: {
      type: String
    },

    visits: [
      {
        inTime: {
          type: String
        },

        outTime: {
          type: String
        }
      }
    ]
  }
],
  event:{type:String}
}
,
{
  timestamps:true,
  strict:false
}
);

const Activity = mongoose.models.Activity || mongoose.model("Activity", activitySchema, "Activity");

function getISTTime() {
  return new Date()
    .toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}
//event params
app.get('/api/user/:event',async(req,res)=>{
  try{
    const { event } = req.params;
    const users = await User.find({ event }).lean();
  return res.status(200).json({status:'success',message:users})
  }catch(err){
    return res.status(500).json({ status: "error", message:err.message });
  }
})
//event body
app.post("/api/user", async (req, res) => {
  const { email,mobileno,event,...rest } = req.body;

  try {

    const query = {
      event,
      $or: []
    };

    if (email) query.$or.push({ email });
    if (mobileno) query.$or.push({ mobileno });

    const existing = await User.findOne(query).lean();

    if (existing) {
      return res.status(409).json({ status: "success", message: "User Already Exists" });
    }

    const user = await User.create({ email,mobileno,event,...rest });

    if (email) {
      sendRegistrationEmail(email, user.fullname, user.salutation).catch((err) => {
        console.error("Error sending Email via Nodemailer : ", err);
      });
    }

    res.status(201).json({
      status: "success",
      message: "User created"
    });
    
  } catch (err) {
   return res.status(500).json({ status: "error", message:err.message });
  }
});
//event params
app.get('/api/activity/:event',async(req,res)=>{
  try{
        const { event } = req.params;

  const activities=await Activity.find({event}).populate('user').lean()
  return res.status(200).json({status:'success',message:activities})
  }catch(err){
    return res.status(500).json({ status: "error", message:err.message });
  }
})
//event body
app.post("/api/activity", async (req, res) => {
  try {
    const {
      loginTime,
      viewIn,
      viewOut,
      stallIn,
      stallOut,
      stall,
      event,
      user,
    } = req.body;

    const time = getISTTime();

    let activity = await Activity.findOne({ user, event });

    if (!activity) {
      activity = new Activity({
        user,
        event,
        auditorium: [],
        stalls: [],
      });
    }

    if (loginTime) {
      if (!activity.firstLogin) {
        activity.firstLogin = time;
      }
      activity.lastLogin = time;
    }

    if (viewIn) {
      activity.auditorium.push({
        inTime: time,
      });
    }

    if (viewOut) {
      const lastVisit = activity.auditorium.at(-1);

    if (lastVisit && !lastVisit.outTime) {
        lastVisit.outTime = time;
        activity.markModified("auditorium");
      }
    }

    if (stallIn) {
      let stallActivity = activity.stalls.find(
        (s) => s.stall === stall
      );

      if (!stallActivity) {
        stallActivity = {
          stall,
          visits: [{ inTime: time }],
        };
        activity.stalls.push(stallActivity);
      } else {
        stallActivity.visits.push({
          inTime: time,
        });
      }

      activity.markModified("stalls");
    }

    if (stallOut) {
      const stallActivity = activity.stalls.find(
        (s) => s.stall === stall
      );

      if (stallActivity) {
        const lastVisit = stallActivity.visits.at(-1);
        if (lastVisit && !lastVisit.outTime) {
          lastVisit.outTime = time;
          activity.markModified("stalls");
        }
      }
    }

    await activity.save();

    return res.status(202).json({
      status: "success",
      message: "Activity Updated",
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});


app.post("/api/user/status", async (req, res) => {
  try {
      const { event,user } = req.body;

    const existing = await User.findOne({_id:user,event}).lean();

    if (existing) {

      return res.status(200).json({
        status: "success",
        message: "User Exists"
      });
    }

       return res.status(404).json({
        status: "success",
        message: "No User Exists",
      });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});
//event body
app.post("/api/auth", async (req, res) => {
  try {
    const { email, mobileno,event } = req.body;

    if (!event) {
      return res.status(400).json({
        status: "error",
        message: "event Required",
      });
    }

    if (!email && !mobileno) {
      return res.status(400).json({
        status: "error",
        message: "email or mobileno Required",
      });
    }

    const query = {
      event,
      $or: []
    };

    if (email) query.$or.push({ email });
    if (mobileno) query.$or.push({ mobileno });

    const existing = await User.findOne(query).lean();

    if (existing) {
      return res.status(200).json({
        status: "success",
        message: existing._id,
      });
    }

    return res.status(404).json({
      status: "success",
      message: "No User Exists",
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

app.get("/api", (req, res) => {
  res.status(200).send("Om Ganeshaay Namah");
});


app.post("/api/users/send-reminder-email", async (req, res) => {
  try {
    const users = await User.find({
      email: { $exists: true, $ne: "" }
    }).lean();

    if (!users.length) {
      return res.status(404).json({
        status: "error",
        message: "No users with email found."
      });
    }

    const failedFile = path.join(__dirname, "failed-emails.txt");

    await fs.writeFile(failedFile, "");

    let successCount = 0;
    const failed = [];

    for (const user of users) {
      try {
        await sendReminderEmail(
          user.email,
          user.fullname,
          user.salutation
        );

        successCount++;
        console.log(`✅ Email sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed for ${user.email}: ${err.message}`);

        failed.push({
          email: user.email,
          error: err.message
        });

        await fs.appendFile(
          failedFile,
          `[${new Date().toISOString()}] ${user.email} | ${err.message}\n`,
          "utf8"
        );
      }
    }

    return res.status(200).json({
      status: "success",
      totalUsers: users.length,
      emailsSent: successCount,
      failedCount: failed.length,
      failedLog: failed.length ? failedFile : null,
      failed
    });

  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

app.listen(PORT, () => {
  connectDB();
});