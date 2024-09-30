import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url);
    this.dbName = database;

    this.client
      .connect()
      .then(() => {
        this.db = this.client.db(this.dbName);
        console.log('Connected successfully to MongoDB');
      })
      .catch((error) => {
        console.error('Failed to connect to MongoDB:', error);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    await this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    await this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
