// src/server.js
require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('path');

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

// GET /releases?id=1&title=Movie Title&releaseDate=2002-04-01&type=movie
app.get('/releases', async (req, res) => {
  try {
    const { id, title, releaseDate, type } = req.query;

    // Construct the 'where' filter dynamically
    const where = {};

    // Filter by id if provided
    if (id) 
    {
      where.id = parseInt(id, 10);
      console.log(`Filtering by id: ${where.id}`);
    }

    // Filter by title if provided (case-insensitive search)
    if (title) 
    {
      where.title = { contains: title, mode: 'insensitive' };
      console.log(`Filtering by title: ${title}`);
    }
    // Handle releaseDate filtering
    if (releaseDate) {
      const [year, month, day] = releaseDate.split('-');

      if (day) {
        // If day is provided (YYYY-MM-DD), filter by the exact date
        const gte = new Date(`${year}-${month}-${day}`);
        lt = gte;
        if (parseInt(day, 10) < 9)
        {
          lt = new Date(`${year}-${month}-0${parseInt(day, 10) + 1}`);
        }
        else
        {
          lt = new Date(`${year}-${month}-${parseInt(day, 10) + 1}`);
        }
        
        // Log the gte and lt for debugging
        console.log(`Filtering by exact date: gte = ${gte} lt = ${lt}`);
        
        where.releaseDate = { gte, lt };
      } else if (month) {
        // If only year and month are provided (YYYY-MM), filter by the entire month
        const gte = new Date(`${year}-${month}-01`);  // Start of the month
        lt = gte
        if (parseInt(month,10) < 9)
        {
          lt = new Date(`${year}-0${parseInt(month, 10) + 1}-01`);  // Start of the next month
        }
        else if (parseInt(month,10) < 12)
        {
          lt = new Date(`${year}-${parseInt(month, 10) + 1}-01`);  // Start of the next month
        }
        console.log(`Filtering by month: gte = ${gte} lt = ${lt}`);
        
        where.releaseDate = { gte, lt };
      } else {
        // If only year is provided (YYYY), filter by the entire year
        const gte = new Date(`${year}-01-01`);  // Start of the year
        const lt = new Date(`${parseInt(year, 10) + 1}-01-01`);  // Start of the next year
        
        // Log the gte and lt for debugging
        console.log(`Filtering by year: gte = ${gte} lt = ${lt}`);
        
        where.releaseDate = { gte, lt };
      }
    }

    // Filter by type if provided (either 'movie' or 'tv')
    if (type) 
    {
      where.type = type;
      console.log(`Filtering by type: ${type}`);
    }
    // Fetch releases based on filters
    const list = await prisma.release.findMany({
      where,
      orderBy: { releaseDate: 'asc' },  // Optionally, you can sort by release date if desired
    });

    res.json(list);  // Return filtered releases as a JSON response
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch releases.' });
  }
});




// GET /releaseGenre?releaseId=1&genreId=2
app.get('/releaseGenre', async (req, res) => {
  try {
    const { releaseId, genreId } = req.query;

    const where = {};

    if (releaseId) where.releaseId = parseInt(releaseId, 10);  // Filter by releaseId if provided
    if (genreId) where.genreId = parseInt(genreId, 10);  // Filter by genreId if provided

    // Fetch the release-genre associations from ReleaseGenre
    const releaseGenres = await prisma.releaseGenre.findMany({
      where,
      include: {
        release: true,  // Include the release data (title, release date, etc.)
        genre: true,    // Include the genre data (name, tmdbId, etc.)
      },
    });

    res.json(releaseGenres);  // Return all release-genre associations
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch release genres.' });
  }
});







// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});
