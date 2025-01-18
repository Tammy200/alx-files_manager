import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
// import Queue from 'bull';
import mime from 'mime-types';
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
        return res.status(400).send({ error: 'Missing name' });
      }
      if (!type || !['folder', 'file', 'image'].includes(type)) {
        return res.status(400).send({ error: 'Missing type' });
      }
      if (!data && type !== 'folder') {
        return res.status(400).send({ error: 'Missing data' });
      }

      if (parentId !== 0) {
        const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!parentFile) {
          return res.status(400).send({ error: 'Parent not found' });
        }
        if (parentFile.type !== 'folder') {
          return res.status(400).send({ error: 'Parent is not a folder' });
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
        return res.status(201).send({
          id: result.insertedId,
          userId: newFile.userId,
          name: newFile.name,
          type: newFile.type,
          isPublic: newFile.isPublic,
          parentId: newFile.parentId,
        });
      }

      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const localPath = path.join(folderPath, uuidv4());
      // if (type === 'image') {
      // await fileQueue.add({ userId, fileId: localPath });
      // }
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
      const fileId = req.params.id || '';
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }

      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
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
      let aggData = [{ $match: { parentId, userId: ObjectId(userId) } },
        { $skip: page * 20 },
        { $limit: 20 },
      ];
      if (parentId === 0) {
        aggData = [{ $skip: page * 20 }, { $limit: 20 }];
      }
      const pageFiles = await dbClient.db.collection('files').aggregate(aggData).toArray();
      pageFiles.forEach((file) => {
        const fileObj = {
          id: file._id,
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

  static async putPublish(req, res) {
    try {
      const token = req.header('X-Token');
      const fileId = req.params.id || '';
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      let file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
      if (!file) {
        return res.status(404).send({ error: 'Not found' });
      }
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
      file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
      return res.status(200).send({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).send('server error');
    }
  }

  static async putUnpublish(req, res) {
    try {
      const token = req.header('X-Token');
      const fileId = req.params.id || '';
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }

      let file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
      if (!file) {
        return res.status(404).send({ error: 'Not found' });
      }
      await dbClient.db.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
      file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });
      return res.status(200).send({
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).send('server error');
    }
  }

  static async getFile(req, res) {
    try {
      const fileId = req.params.id || '';
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });
      if (!file) {
        return res.status(404).send({ error: 'Not found' });
      }
      const token = req.header('X-Token');
      const userId = await redisClient.get(`auth_${token}`);
      const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
      const usrId = user ? user._id.toString() : file.userId.toString();
      if ((!user && (file.isPublic === false)) || ((file.isPublic === false) && (usrId !== file.userId.toString()))) {
        return res.status(404).send({ error: 'Not found' });
      }
      if (file.type === 'folder') {
        return res.status(400).send({ error: 'A folder doesn\'t have content' });
      }
      try {
        const fileData = fs.readFileSync(file.localPath);
        const mimeType = mime.contentType(file.name);
        res.setHeader('Content-Type', mimeType);

        return res.status(200).send(fileData);
      } catch (err) {
        return res.status(404).send({ error: 'Not found' });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).send('server error');
    }
  }
}
