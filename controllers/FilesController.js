import dbClient from '../utils/db';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export default class FilesController {
  static async postUpload(req, res) {
    try {
      const token = req.headers['X-Token'];
      const userId = await redisClient.get(`auth_${token}`);
      if (!token || !userId) {
        return res.status(401).json({"error":"Unauthorized"});
      }
      const {
        name, type, data, parentId ? parentId : 0;, isPublic = false,
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
      let localPath;
      if (type !== 'folder') {
        const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
	if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        localPath = path.join(folderPath, uuidv4());
        fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
      }
      const newFile = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId !== 0 ? ObjectId(parentId) : 0,
        ...(type !== 'folder' && { localPath })
        }

        const result = await dbClient.db.collection('files').insertOne(newFile);

        return res.status(201).json({ ...newFile, id: result.insertedId });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
