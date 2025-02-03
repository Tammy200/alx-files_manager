import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import Queue from 'bull';  // Move this up before dbClient
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue');

export default class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      res.status(400).send({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).send({ error: 'Missing password' });
      return;
    }
    try {
      const usersCollection = dbClient.db.collection('users');

      const user = await usersCollection.findOne({ email });
      if (user) {
        res.status(400).send({ error: 'Already exist' });
        return;
      }
      const hashedPwd = sha1(password);

      const result = await usersCollection.insertOne({ email, password: hashedPwd });
      const userId = result.insertedId;

      await userQueue.add({ userId });

      res.status(201).send({ email, id: userId });
      return;
    } catch (err) {
      await userQueue.add({});
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }

  static async getMe(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const userID = await redisClient.get(`auth_${token}`);
      // console.log(userID);
      if (!userID) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await dbClient.getUser({ _id: ObjectId(userID) });
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // console.log(user);
      return res.status(200).json({ id: user._id, email: user.email });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}
