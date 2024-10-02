import { ObjectID } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

async function getUser(req) {
  const token = req.headers['x-token'];
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return null;
  }
  const user = await dbClient.db
    .collection('users')
    .findOne({ _id: new ObjectID(userId) });

  if (!user) {
    return null;
  }
  return user;
}

export async function postUpload(req, res) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    name, type, parentId = 0, isPublic = false, data,
  } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }
  if (!type || !['folder', 'file', 'image'].includes(type)) {
    return res.status(400).json({ error: 'Missing type' });
  }
  if (!data && type !== 'folder') {
    return res.status(400).json({ error: 'Missing data' });
  }

  let parentFile = null;
  if (parentId) {
    parentFile = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectID(parentId) });

    if (!parentFile) {
      return res.status(400).json({ error: 'Parent not found' });
    }

    if (parentFile.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }
  }

  const newFile = {
    userId: user._id,
    name,
    type,
    isPublic,
    parentId: parentId || 0,
  };

  if (type === 'folder') {
    const output = await dbClient.db.collection('files').insertOne(newFile);
    return res.status(201).json({
      id: output.insertedId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId || 0,
    });
  }

  const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const fileuuid = uuidv4();
  const localPath = path.join(folderPath, fileuuid);
  const fileData = Buffer.from(data, 'base64');
  fs.writeFileSync(localPath, fileData);

  newFile.localPath = localPath;
  const result = await dbClient.db.collection('files').insertOne(newFile);
  return res.status(201).json({
    id: result.insertedId,
    userId: user._id,
    name,
    type,
    isPublic,
    parentId: parentId || 0,
  });
}
