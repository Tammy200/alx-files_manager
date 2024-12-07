import { env } from 'process';
import { MongoClient } from 'mongodb';

const host = env.DB_HOST ? env.DB_HOST : 'localhost';
const port = env.DB_PORT ? env.PORT : '27017';
const dbName = env.DB_DATABASE ? env.DB_DATABASE : 'files_manager';
const url = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        console.error(err);
      }
      this.db = client.db(dbName);
      this.db.createCollection('users');
      this.db.createCollection('files');
    });
  }

  isAlive() {
    return !!this.db;
  }

  async nbUsers() {
    const usersCount = await this.db.collection('users').countDocuments();

    return usersCount;
  }

  async nbFiles() {
    const filesCount = this.db.collection('files').countDocuments();

    return filesCount;
  }
}

const dbClient = new DBClient();
export default dbClient;
