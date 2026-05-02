#!/bin/bash
redis-server --daemonize yes --logfile /tmp/redis.log
npm run start:dev
