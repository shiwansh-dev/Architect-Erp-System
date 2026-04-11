// Script to insert sample CNC Genie data
const { MongoClient } = require('mongodb');

const uri = "mongodb://root:example@mongodb-test1.shiwansh.dedyn.io:27020/testdb?authSource=admin";
const databaseName = "CNC_GENIE";

// Get current date in YY/MM/DD format
const now = new Date();
const currentDate = `${now.getFullYear().toString().slice(-2)}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

const sampleData = {
  "_id": `25_${currentDate}`,
  "ch1": {
    "channel_name": "HK-03",
    "morning": {
      "run_time": 47,
      "working_time": 158,
      "value_sum": 757,
      "average": 7.89,
      "shift_time": "10:30",
      "average_threshold": 7,
      "setting_time": 30
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 7,
      "setting_time": 30
    }
  },
  "ch2": {
    "channel_name": "HK-04",
    "morning": {
      "run_time": 0,
      "working_time": 158,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 6,
      "setting_time": 30
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 6,
      "setting_time": 30
    }
  },
  "ch3": {
    "channel_name": "HK-01",
    "morning": {
      "run_time": 58,
      "working_time": 158,
      "value_sum": 357,
      "average": 3,
      "shift_time": "10:30",
      "average_threshold": 7,
      "setting_time": 43
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 7,
      "setting_time": 43
    }
  },
  "ch4": {
    "channel_name": "HK-02",
    "morning": {
      "run_time": 0,
      "working_time": 158,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 12,
      "setting_time": 58
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 12,
      "setting_time": 58
    }
  },
  "ch5": {
    "channel_name": "LATHE-16",
    "morning": {
      "run_time": 100,
      "working_time": 158,
      "value_sum": 2354,
      "average": 11.6,
      "shift_time": "12:00",
      "average_threshold": 10,
      "setting_time": 37
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "12:00",
      "average_threshold": 10,
      "setting_time": 37
    }
  },
  "ch6": {
    "channel_name": "LATHE-2",
    "morning": {
      "run_time": 64,
      "working_time": 158,
      "value_sum": 1361,
      "average": 10.47,
      "shift_time": "10:30",
      "average_threshold": 11,
      "setting_time": 29
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 11,
      "setting_time": 29
    }
  },
  "ch7": {
    "channel_name": "LATHE-15",
    "morning": {
      "run_time": 0,
      "working_time": 158,
      "value_sum": 22,
      "average": 11,
      "shift_time": "10:30",
      "average_threshold": 8,
      "setting_time": 41
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 8,
      "setting_time": 41
    }
  },
  "ch8": {
    "channel_name": "LATHE-6",
    "morning": {
      "run_time": 136,
      "working_time": 158,
      "value_sum": 4657,
      "average": 16.75,
      "shift_time": "10:30",
      "average_threshold": 12,
      "setting_time": 52
    },
    "night": {
      "run_time": 0,
      "working_time": 0,
      "value_sum": 0,
      "average": 0,
      "shift_time": "10:30",
      "average_threshold": 12,
      "setting_time": 52
    }
  },
  "currentdate": currentDate,
  "deviceno": 25
};

async function insertSampleData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(databaseName);
    const collection = db.collection('shiftwise_data');
    
    // Check if data already exists
    const existingData = await collection.findOne({ _id: sampleData._id });
    if (existingData) {
      console.log('Sample data already exists in the database');
      return;
    }
    
    // Insert the sample data
    const result = await collection.insertOne(sampleData);
    console.log('Sample data inserted successfully:', result.insertedId);
    
  } catch (error) {
    console.error('Error inserting sample data:', error);
  } finally {
    await client.close();
  }
}

// Run the script
insertSampleData();
