import sha1 from 'sha1';
import dbClient from '../utils/db';

export default class UsersController {
  static async postNew(req, res) {
    console.log(req.body);
    const { email, password } = req.body;
    console.log(req.body);

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

      res.status(201).send({ email, id: userId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
}
