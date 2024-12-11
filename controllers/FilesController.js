import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class FilesController {
  static async postUpload(req, res) {
    try {
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      if (!token || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const {
        name, type, data, parentId = 0, isPublic = false,
      } = req.body;

      if (!name) {
        return res.status(400).send('Missing name');
      }
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).send('Missing type');
      }
      if (!data && type !== 'folder') {
        return res.status(400).send('Missing data');
      }

      if (parentId !== 0) {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).send('Parent not found');
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).send('Parent is not a folder');
        }
      }

      const newFile = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId !== 0 ? ObjectId(parentId) : 0,
      };
      if (type === 'folder') {
        const result = await dbClient.db.collection('files').insertOne(newFile);
        return res.status(201).send(({ ...newFile, id: result.insertedId }));
      }

      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const localPath = path.join(folderPath, uuidv4());
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

      newFile.localPath = localPath;
      const result = await dbClient.db.collection('files').insertOne(newFile);

      return res.status(201).json({
        id: result.insertedId,
        userId: newFile.userId,
        name,
        type,
        isPublic,
        parentId: parentId !== 0 ? ObjectId(parentId) : 0,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(req, res) {
    try {
      const fileId = req.param.id;
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ userId });
      if (!user) {
        return res.status(401).send({ errpr: 'Unauthorized' });
      }
      const file = await dbClient.db.collection('files').findOne({ fileId, userId });
      if (!file) {
        return res.status(404).send({ error: 'Not found' });
      }
      return res.status(200).send({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).send('server Error');
    }
  }

  static async getIndex(req, res) {
    try {
      const parentId = req.query.parentId ? ObjectId(req.query.parentId) : 0;
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      if (parentId !== 0) {
        const folder = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!folder || folder.type !== 'folder') {
          return res.status(200).send([]);
        }
      }
      const files = [];
      const page = parseInt(req.query.page, 10) || 0;
      const pageFiles = await dbClient.db.collection('files').aggregate([
        { $match: { parentId, userId: ObjectId(userId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ]).toArray();
      pageFiles.forEach((file) => {
        const fileObj = {
          id: file.id,
          userId: file.userId,
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId,
        };
        files.push(fileObj);
      });

      return res.status(200).send(files);
    } catch (err) {
      console.error(err);
      return res.status(500).send('server Error');
    }
  }
}
