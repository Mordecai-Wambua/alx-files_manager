import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export function getStatus(req, res) {
  if (redisClient.isAlive() && dbClient.isAlive()) {
    res.status(200).json({ redis: true, db: true });
  }
}

export async function getStats(req, res) {
  const users = await dbClient.nbUsers();
  const files = await dbClient.nbFiles();
  res.status(200).json({ users, files });
}
