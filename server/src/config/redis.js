import { createClient } from 'redis';

import env from './env.js';

let redisClient = null;

export const connectRedis = async () => {
  if (!env.redis.enabled) {
    console.log('Redis is disabled.');
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  redisClient = createClient({
    url: env.redis.url,
  });

  redisClient.on('error', (error) => {
    console.error('Redis client error:', error);
  });

  redisClient.on('connect', () => {
    console.log('Redis connection established.');
  });

  redisClient.on('ready', () => {
    console.log('Redis client ready.');
  });

  redisClient.on('reconnecting', () => {
    console.log('Redis client reconnecting...');
  });

  redisClient.on('end', () => {
    console.log('Redis connection closed.');
  });

  await redisClient.connect();

  return redisClient;
};

export const getRedisClient = () => {
  return redisClient;
};

export const disconnectRedis = async () => {
  if (!redisClient) {
    return;
  }

  if (redisClient.isOpen) {
    await redisClient.quit();
  }

  redisClient = null;
};