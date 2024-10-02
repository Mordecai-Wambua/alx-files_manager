import { ObjectID } from 'mongodb';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
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

export async function getShow(req, res) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fileId = req.params.id;

  try {
    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectID(fileId), userId: user._id });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function getIndex(req, res) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parentId = parseInt(req.query.parentId, 10) || 0;
  const page = parseInt(req.query.page, 10) || 0;
  const pageSize = 20;

  try {
    const files = await dbClient.db
      .collection('files')
      .aggregate([
        { $match: { userId: user._id, parentId } },
        { $skip: page * pageSize },
        { $limit: pageSize },
      ])
      .toArray();
    return res.status(200).json(files);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function putPublish(req, res) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const fileId = req.params.id;

  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: new ObjectID(fileId), userId: user._id });

  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }
  await dbClient.db
    .collection('files')
    .updateOne(
      { _id: new ObjectID(fileId), userId: user._id },
      { $set: { isPublic: true } },
    );

  const updatedFile = await dbClient.db
    .collection('files')
    .findOne({ _id: new ObjectID(fileId) });

  return res.status(200).json(updatedFile);
}

export async function putUnpublish(req, res) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const fileId = req.params.id;

  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: new ObjectID(fileId), userId: user._id });

  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  await dbClient.db
    .collection('files')
    .updateOne(
      { _id: new ObjectID(fileId), userId: user._id },
      { $set: { isPublic: false } },
    );

  const updatedFile = await dbClient.db
    .collection('files')
    .findOne({ _id: new ObjectID(fileId) });

  return res.status(200).json(updatedFile);
}

export async function getFile(req, res) {
  const fileId = req.params.id;
  const user = await getUser(req);

  const file = await dbClient.db
    .collection('files')
    .findOne({ _id: new ObjectID(fileId) });

  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (file.type === 'folder') {
    return res.status(400).json({ error: "A folder doesn't have content" });
  }

  if (
    !file.isPublic
    && (!user || file.userId.toString() !== user._id.toString())
  ) {
    return res.status(404).json({ error: 'Not found' });
  }

  const filePath = `/tmp/files_manager/${file.localPath}`;
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  const mimeType = mime.lookup(file.name) || 'application/octet-stream';

  const fileContent = fs.readFileSync(filePath);
  res.setHeader('Content-Type', mimeType);
  return res.status(200).send(fileContent);
}
