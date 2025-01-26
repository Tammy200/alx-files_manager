import Queue from 'bull';
import dbClient from './utils/db';
import { promises } from 'fs';

const imageThumbnail = require('image-thumbnail');



const fileQueue = new Queue('fileQueue');
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    console.log('Missing fileId');
    throw new Error('Missing fileId');
  }
  if (!userId) {
    console.log('Missing userId');
    throw new Error('Missing userId');
  }

   const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) , userId: ObjectId(userId)});
  if (!file) {
    throw new Error('File not found');
  }

  const { localPath } = file;
  console.log(localPath);
  const options = {};
  const widths = [500, 250, 100];

  widths.forEach(async (width) => {
    option.width = width;
    try {
      const thumbNail = await imageThumbnail(localPath, options);
      await promises.writeFile(`${localPath}_${width}`, thumbNail);
      console.log('after writing..');
      console.log(thumbNail);
    } catch (err) {
      console.error(err.message);
    }
  });
});
