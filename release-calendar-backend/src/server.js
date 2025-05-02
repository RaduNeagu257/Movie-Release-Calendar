// src/server.js
require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('path');
const cors = require('cors');

const prisma = new PrismaClient();
const app    = express();
app.use(
  cors({
    origin: 'http://localhost:3000',             // or '*' for wide-open during dev
  })
);
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

// GET /releaseGenre?
//   releaseId=1
//   &genreId=2
//   &id=71547
//   &title=Fantasia
//   &releaseDate=2000-01-01
//   &type=movie
app.get('/releaseGenre', async (req, res) => {
  try {
    const {
      releaseId,
      genreId,
      id,          // filters on Release.id
      title,
      releaseDate, // YYYY or YYYY-MM or YYYY-MM-DD
      type,
    } = req.query;

    // 1) Build the top-level pivot filters
    const where = {};
    if (releaseId) {
      where.releaseId = parseInt(releaseId, 10);
      console.log(`Filtering pivot by releaseId: ${where.releaseId}`);
    }
    if (genreId) {
      where.genreId = parseInt(genreId, 10);
      console.log(`Filtering pivot by genreId: ${where.genreId}`);
    }

    // 2) Build any nested filters on the related Release
    const releaseFilter = {};
    if (id) {
      releaseFilter.id = parseInt(id, 10);
      console.log(`Filtering release by id: ${releaseFilter.id}`);
    }
    if (title) {
      releaseFilter.title = { contains: title, mode: 'insensitive' };
      console.log(`Filtering release by title: ${title}`);
    }
    if (type) {
      releaseFilter.type = type;
      console.log(`Filtering release by type: ${type}`);
    }
    if (releaseDate) {
      const parts = releaseDate.split('-').map(p => parseInt(p, 10));
      const year  = parts[0];
      const month = parts[1];
      const day   = parts[2];
      let gte, lt;

      if (day) {
        // exact day
        gte = new Date(year, month - 1, day);
        lt  = new Date(year, month - 1, day + 1);
        console.log(`Filtering release by exact date: gte=${gte} lt=${lt}`);
      } else if (month) {
        // whole month
        gte = new Date(year, month - 1, 1);
        lt  = new Date(year, month, 1);
        console.log(`Filtering release by month: gte=${gte} lt=${lt}`);
      } else {
        // whole year
        gte = new Date(year, 0, 1);
        lt  = new Date(year + 1, 0, 1);
        console.log(`Filtering release by year: gte=${gte} lt=${lt}`);
      }

      releaseFilter.releaseDate = { gte, lt };
    }

    // If we have any release-level filters, attach them under `release.is`
    if (Object.keys(releaseFilter).length > 0) {
      where.release = { is: releaseFilter };
    }

    // 3) Fetch via Prisma
    const list = await prisma.releaseGenre.findMany({
      where,
      include: {
        release: true,
        genre:   true,
      },
      orderBy: {
        release: { releaseDate: 'asc' }
      }
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch release-genre associations.' });
  }
});









// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
});
