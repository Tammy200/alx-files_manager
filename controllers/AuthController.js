import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import atob from 'atob';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ error: 'Unauthorized' });
    }
    try {
      const cridentials = authHeader.split(' ')[1];
      const [email, password] = atob(cridentials).split(':');
      if (!email || !password) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      // console.log(email, password);
      const hashedPwd = sha1(password);
      const user = await dbClient.getUser({ email });
      if (!user || user.password !== hashedPwd) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const token = uuidv4();
      redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
      return res.status(200).send({ token });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async getDisconnect(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const userID = await redisClient.get(`auth_${token}`);
      if (!userID) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      await redisClient.del(`auth_${token}`);
      return res.status(204).send('Disconnected');
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}
