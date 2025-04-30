// src/server.js
require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app    = express();
app.use(express.json());

// Cron: nightly refresh
cron.schedule('30 0 * * *', () => {
  console.log('🔄 Fetching latest releases…');
  spawn('npm', ['run', 'fetch'], { stdio: 'inherit' });
});

// GET /genres
app.get('/genres', async (req, res) => {
  try {
    const allGenres = await prisma.genre.findMany();
    res.json(allGenres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch genres.' });
  }
});

// GET /releases?type=movie
app.get('/releases', async (req, res) => {
  try {
    const { type } = req.query;

    // Construct the query to fetch all releases
    const where = {};
    if (type) where.type = type;  // Only filter by 'movie' or 'tv'

    // Fetch releases with no date filters
    const list = await prisma.release.findMany({
      where,
      orderBy: { releaseDate: 'asc' },  // Optionally, you can sort by release date if desired
    });

    res.json(list);  // Return all releases as a JSON response
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch releases.' });
  }
});






// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});
