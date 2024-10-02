import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export async function postNew(req, res) {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Missing password' });
  }

  const user = await dbClient.db.collection('users').findOne({ email });
  if (user) {
    return res.status(400).json({ error: 'Already exist' });
  }

  const hash = sha1(password);

  try {
    const newUser = await dbClient.createUser(email, hash);
    return res.status(201).json({ id: newUser.insertedId, email });
  } catch (error) {
    return res.status(500).json({ error: 'Error creating user' });
  }
}

export async function getMe(req, res) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = await dbClient.db
    .collection('users')
    .findOne({ _id: new ObjectID(userId) });

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({ id: user._id, email: user.email });
}
