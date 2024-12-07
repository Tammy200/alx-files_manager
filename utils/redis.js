import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor () {
    this.client = createClient();
    this.client.on('error', (err) => {
        console.log(err);
      });

    this.getAsync = promisify(this.client.GET).bind(this.client);
    this.setexAsync = promisify(this.client.SETEX).bind(this.client);
    this.delAsync = promisify(this.client.DEL).bind(this.client);
  }

  isAlive() {
    return this.client.connected; 
  }

  async get(key) {
    const value = await this.getAsync(key);;

    return value;
  }

  async set(key, val, duration) {
    await this.setexAsync(key, duration, val);
  }

  async del(key) {
    await this.delAsync(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
