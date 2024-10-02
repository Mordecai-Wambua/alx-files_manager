import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export async function getConnect(req, res) {
  const header = req.headers.authorization;

  if (!header) {
    res.setHeader('WWW-Authenticate', 'Basic');
    return res.status(401).json({ error: 'Authentication Required' });
  }
  const base64 = header.split(' ')[1];
  const strings = Buffer.from(base64, 'base64').toString('ascii');
  const [email, password] = strings.split(':');
  const hash = sha1(password);

  const user = await dbClient.db
    .collection('users')
    .findOne({ email, password: hash });

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = uuidv4();
  const key = `auth_${token}`;
  await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
  return res.status(200).json({ token });
}

export async function getDisconnect(req, res) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await redisClient.del(key);
  return res.status(204).send();
}
