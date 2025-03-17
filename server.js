require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");
const moment = require("moment-timezone");

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// MySQL Database Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
});

console.log("Connected to MySQL Database");

// Function to Convert UTC to IST (Only Date)
const formatDateIST = (utcTimestamp) => {
  if (!utcTimestamp || utcTimestamp === "0000-00-00 00:00:00") return "Invalid Date";
  return moment.utc(utcTimestamp).tz("Asia/Kolkata").format("DD-MM-YYYY");
};

// ✅ API to Fetch Data (Fetching from `user_data` and `lead_stored`)
app.get("/data", async (req, res) => {
  const sql = `
    SELECT 
      u.mobile, 
      u.pincode, 
      u.timestamp, 
      COALESCE(l.feedback, 'Click to edit') AS feedback, 
      COALESCE(l.status, 'Select Status') AS status
    FROM user_data u
    LEFT JOIN lead_stored l ON u.mobile = l.mobile AND u.pincode = l.pincode
    ORDER BY u.timestamp DESC;
  `;

  try {
    const [result] = await db.query(sql);

    // Convert timestamp to IST Date Only
    const formattedResult = result.map((item) => ({
      ...item,
      timestamp: formatDateIST(item.timestamp),
    }));

    res.json(formattedResult);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to retrieve data" });
  }
});

// ✅ API to Store Data in `lead_stored`
app.post("/store-lead", async (req, res) => {
  const { mobile, pincode, feedback, status } = req.body;

  console.log("Store Lead Request Body:", req.body);

  if (!mobile || !pincode) {
    return res.status(400).json({ error: "Mobile and Pincode are required" });
  }

  const sql = `
    INSERT INTO lead_stored (mobile, pincode, feedback, status) 
    VALUES (?, ?, ?, ?);
  `;

  try {
    await db.query(sql, [mobile, pincode, feedback, status]);
    res.json({ message: "Lead stored successfully!" });
  } catch (error) {
    console.error("Error storing lead data:", error);
    res.status(500).json({ error: "Failed to store lead data" });
  }
});

// ✅ API to Update Feedback & Status



// app.put("/update", async (req, res) => {
//   console.log("Received Update Request:", req.body);

//   const { mobile, pincode, feedback, status } = req.body;

//   if (!mobile || !pincode) {
//     return res.status(400).json({ error: "Mobile and Pincode are required" });
//   }

//   try {
//     const [result] = await db.query(
//       "UPDATE lead_stored SET feedback = ?, status = ? WHERE mobile = ? AND pincode = ?",
//       [feedback, status, mobile, pincode]
//     );

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: "Record not found" });
//     }

//     res.json({ message: "Data updated successfully!" });
//   } catch (error) {
//     console.error("Error updating database:", error);
//     res.status(500).json({ error: "Database update failed" });
//   }
// });

app.put("/update", async (req, res) => {
  console.log("Received Update Request:", req.body);

  const { mobile, pincode, feedback, status } = req.body;

  if (!mobile || !pincode) {
    return res.status(400).json({ error: "Mobile and Pincode are required" });
  }

  try {
    // Step 1: Check if record exists
    const [existingRecord] = await db.query(
      "SELECT * FROM lead_stored WHERE mobile = ? AND pincode = ?",
      [mobile, pincode]
    );

    if (existingRecord.length === 0) {
      // Step 2: If record doesn't exist, insert with current timestamp
      await db.query(
        "INSERT INTO lead_stored (mobile, pincode, feedback, status, timestamp) VALUES (?, ?, ?, ?, NOW())",
        [mobile, pincode, feedback, status]
      );

      return res.json({ message: "New record inserted successfully with timestamp!" });
    }

    // Step 3: If record exists, update feedback, status, and timestamp
    const [updateResult] = await db.query(
      "UPDATE lead_stored SET feedback = ?, status = ?, timestamp = NOW() WHERE mobile = ? AND pincode = ?",
      [feedback, status, mobile, pincode]
    );

    res.json({ message: "Data updated successfully with latest timestamp!" });
  } catch (error) {
    console.error("Error updating database:", error);
    res.status(500).json({ error: "Database update failed" });
  }
});







// API to Delete Data when "Delete" is Clicked
app.delete("/delete", async (req, res) => {
  const { mobile, pincode } = req.body;

  console.log("Delete Request Body:", req.body);

  if (!mobile || !pincode) {
    return res.status(400).json({ error: "Mobile and Pincode are required" });
  }

  try {
    const [result] = await db.query("DELETE FROM lead_stored WHERE mobile = ? AND pincode = ?", [
      mobile,
      pincode,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    res.json({ message: "Data deleted successfully!" });
  } catch (error) {
    console.error("Error deleting data:", error);
    res.status(500).json({ error: "Failed to delete data" });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
