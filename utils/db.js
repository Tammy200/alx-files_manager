import { env } from 'process';
import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = env.DB_HOST || 'localhost';
    this.port = env.DB_PORT || '27017';
    this.dbName = env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${this.host}:${this.port}/${this.dbName}`;

    MongoClient.connect(url, { useUnifiedTopology: true }, (err, client) => {
      if (err) {
        console.error(`DB Connection Error: ${err}`);
        return;
      }
      this.db = client.db(this.dbName);
    });
  }

  isAlive() {
    return !!this.db;
  }

  async nbUsers() {
    if (!this.isAlive()) {
      return 0;
    }
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.isAlive()) {
      return 0;
    }
    return this.db.collection('files').countDocuments();
  }

  async getUser(query) {
    const user = await this.db.collection('users').findOne(query);
    return user;
  }
}

const dbClient = new DBClient();
export default dbClient;
