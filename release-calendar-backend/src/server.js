// src/server.js
require('dotenv').config();
const express = require('express');
const cron    = require('node-cron');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { parse } = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const prisma = new PrismaClient();
const app    = express();
app.use(
  cors({
    origin: `${process.env.BASE_URL}:${process.env.FRONTEND_PORT}`,
  })
);
app.use(express.json());
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = auth.slice(7); // remove "Bearer "
  try {
    const { userId } = jwt.verify(token, JWT_SECRET);
    req.userId = userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
app.use('/watchlist', authMiddleware);

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
    const { 
      id,
      title,
      releaseDate, 
      type 
    } = req.query;

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

// GET /releaseGenre?releaseId=1&genreId=2&id=71547&title=Fantasia&releaseDate=2000-01-01&type=movie
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



// Hash the password using bcrypt
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare a plain text password with a hashed password
const comparePasswords = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// POST /register
app.post('/register', async (req, res) => {
  console.log('Registering user...');
  const {
    email, 
    password 
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create a new user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  console.log('Logging in user...');
  const {
    email, 
    password 
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare the provided password with the stored hash
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // If login is successful, return user data (or set session cookies)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
    //res.status(200).json({ message: 'Login successful', user: { email: user.email, id: user.id } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//GET /watchlist
app.get('/watchlist', async (req, res) => {
  try {
    // 1) Get each pivot row (releaseId, watched, rating) for this user, in descending order by createdAt
    const entries = await prisma.watchlist.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        releaseId: true,
        watched:   true,
        rating:    true
      }
    });

    // 2) For each watched pivot, fetch Release + its genres
    const result = await Promise.all(
      entries.map(async (entry) => {
        // 2a) Fetch core release fields
        const r = await prisma.release.findUnique({
          where: { id: entry.releaseId },
          select: {
            id:          true,
            title:       true,
            releaseDate: true,
            type:        true,
            posterPath:  true
          }
        });
        // 2b) Fetch all genres for that release via the pivot
        const pivotRows = await prisma.releaseGenre.findMany({
          where: { releaseId: entry.releaseId },
          include: { genre: true }
        });
        const genres = pivotRows.map(rg => ({
          id:   rg.genre.id,
          name: rg.genre.name
        }));

        return {
          id:          r.id,
          title:       r.title,
          releaseDate: r.releaseDate,
          type:        r.type,
          posterPath:  r.posterPath,
          watched:     entry.watched,
          rating:      entry.rating,
          genres
        };
      })
    );

    // 3) Return that combined array
    res.json(result);
  } catch (err) {
    console.error('GET /watchlist error:', err);
    res.status(500).json({ error: 'Unable to fetch watchlist' });
  }
});



// ── POST /watchlist ──
// Body: { releaseId: number, watched?: boolean, rating?: number }
app.post('/watchlist', async (req, res) => {
  const {
    releaseId, 
    watched = false, 
    rating = null 
  } = req.body;
  if (!releaseId) {
    return res.status(400).json({ error: 'releaseId is required' });
  }
  try {
    const entry = await prisma.watchlist.create({
      data: {
        userId:    req.userId,
        releaseId: parseInt(releaseId, 10),
        watched,
        rating
      }
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error('POST /watchlist error:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Already in watchlist' });
    }
    res.status(500).json({ error: 'Unable to add to watchlist' });
  }
});

// ── PATCH /watchlist/:releaseId ──
// Body: { watched: boolean }
app.patch('/watchlist/:releaseId', async (req, res) => {
  const releaseId = parseInt(req.params.releaseId, 10)
  const { 
    watched, 
    rating 
  } = req.body
  // rating might be undefined, or "LIKE", or "DISLIKE"

  console.log("rating:", rating);
  // Build a dynamic "data" object:
  const dataToUpdate = {}
  if (typeof watched === 'boolean') {
    dataToUpdate.watched = watched
  }
  if (rating === 'LIKE' || rating === 'DISLIKE' || rating === null) {
    dataToUpdate.rating = rating
  }

  // If neither field is present, return 400:
  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({ error: 'Nothing to update. Provide watched or rating.' })
  }

  try {
    const updated = await prisma.watchlist.update({
      where: {
        userId_releaseId: {
          userId:    req.userId,
          releaseId
        }
      },
      data: dataToUpdate
    })
    res.json(updated)
  } catch (err) {
    console.error('PATCH /watchlist error:', err)
    res.status(500).json({ error: 'Unable to update watchlist' })
  }
})


// DELETE /watchlist/:releaseId
app.delete('/watchlist/:releaseId', async (req, res) => {
  const releaseId = parseInt(req.params.releaseId, 10);
  if (!releaseId) {
    return res.status(400).json({ error: 'Invalid releaseId' });
  }
  try {
    await prisma.watchlist.delete({
      where: {
        userId_releaseId: {
          userId:    req.userId,
          releaseId,
        }
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /watchlist error:', err);
    res.status(500).json({ error: 'Unable to remove from watchlist' });
  }
});

// GET /user/preferences
app.get('/user/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId

    // Fetch the user’s “preferencesCompleted” flag
    // and all preferred‐genre join rows
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferencesCompleted: true,
        preferredGenres: {
          select: { genreId: true }
        }
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const genreIds = user.preferredGenres.map(pg => pg.genreId)
    res.json({
      preferencesCompleted: user.preferencesCompleted,
      genreIds
    })
  } catch (err) {
    console.error('GET /user/preferences error:', err)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})


// POST /user/preferences
app.post('/user/preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const { 
      genreIds 
    } = req.body

    if (!Array.isArray(genreIds)) {
      return res.status(400).json({ error: 'genreIds must be an array of numbers' })
    }

    // 1) Delete all existing preferences for this user
    await prisma.userPreferredGenre.deleteMany({
      where: { userId }
    })

    // 2) Bulk‐create the new ones (skipDuplicates just in case)
    if (genreIds.length > 0) {
      const createData = genreIds.map((gid) => ({ userId, genreId: gid }))
      await prisma.userPreferredGenre.createMany({
        data: createData,
        skipDuplicates: true
      })
    }

    // 3) Mark preferencesCompleted = true
    await prisma.user.update({
      where: { id: userId },
      data: { preferencesCompleted: true }
    })

    // 4) Return the updated prefs
    res.json({
      preferencesCompleted: true,
      genreIds
    })
  } catch (err) {
    console.error('POST /user/preferences error:', err)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// GET /releases/popular?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=20
app.get('/releases/popular', async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    // parse the ISO-date strings
    const start = new Date(startDate);
    const end   = new Date(endDate);

    // 1) fetch all watchlist entries whose release falls in [start, end)
    const entries = await prisma.watchlist.findMany({
      where: {
        release: {
          releaseDate: { gte: start, lt: end }
        }
      },
      select: { releaseId: true, rating: true }
    });

    // 2) compute score = (# of LIKE) − (# of DISLIKE) per releaseId
    const scoreMap = {};
    entries.forEach(({ releaseId, rating }) => {
      const delta = rating === 'LIKE' ? 1
                  : rating === 'DISLIKE' ? -1
                  : 0;
      scoreMap[releaseId] = (scoreMap[releaseId] || 0) + delta;
    });

    // 3) sort by descending score, take top N
    const topIds = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, parseInt(limit, 10) || 20)
      .map(([id]) => parseInt(id, 10));

    if (topIds.length === 0) {
      return res.json([]);
    }

    // 4) fetch those releases’ basic info
    const releases = await prisma.release.findMany({
      where: { id: { in: topIds } },
      select: { id: true, title: true, posterPath: true }
    });

    // 5) re-order to match topIds
    const ordered = topIds
      .map(id => releases.find(r => r.id === id))
      .filter(r => r); // drop any missing

    res.json(ordered);
  } catch (err) {
    console.error('GET /releases/popular error:', err);
    res.status(500).json({ error: 'Failed to fetch popular releases.' });
  }
});

// GET /releases/recommended?releaseId=<id>&limit=<n>
app.get('/releases/recommended', async (req, res) => {
  try {
    const { releaseId: releaseIdParam, limit = '20' } = req.query;
    const limitNum = parseInt(limit, 10) || 20;

    // 1) Determine the base release:
    //    - if releaseId query provided, use it
    //    - otherwise fall back to the user's most recent "LIKE"
    let baseReleaseId = releaseIdParam
      ? parseInt(releaseIdParam, 10)
      : null;

    if (!baseReleaseId) {
      const lastLike = await prisma.watchlist.findFirst({
        where: { userId: req.userId, rating: 'LIKE' },
        orderBy: { createdAt: 'desc' },
        select: { releaseId: true }
      }); // :contentReference[oaicite:0]{index=0}

      if (!lastLike) {
        // No liked items → nothing to recommend
        return res.json({ base: null, items: [] });
      }
      baseReleaseId = lastLike.releaseId;
    }

    // 2) Fetch the base release’s info
    const base = await prisma.release.findUnique({
      where: { id: baseReleaseId },
      select: { id: true, title: true, posterPath: true }
    });

    if (!base) {
      return res.status(404).json({ error: 'Base release not found' });
    }

    // 3) Get all genre-IDs for that release
    const baseGenres = await prisma.releaseGenre.findMany({
      where: { releaseId: baseReleaseId },
      select: { genreId: true }
    });

    const genreIds = baseGenres.map(g => g.genreId);

    if (genreIds.length === 0) {
      // No genres → no recommendations
      return res.json({ base, items: [] });
    }

    // 4) Find other releases sharing those genres
    const pivots = await prisma.releaseGenre.findMany({
      where: {
        genreId: { in: genreIds },
        releaseId: { not: baseReleaseId }
      },
      select: { releaseId: true }
    }); // :contentReference[oaicite:1]{index=1}

    // 5) Count matches per releaseId
    const countMap = {};
    pivots.forEach(({ releaseId }) => {
      countMap[releaseId] = (countMap[releaseId] || 0) + 1;
    });

    // 6) Sort by descending match count and take top N
    const topIds = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitNum)
      .map(([id]) => parseInt(id, 10));

    // 7) Fetch those releases’ details
    const items = await prisma.release.findMany({
      where: { id: { in: topIds } },
      select: { id: true, title: true, posterPath: true }
    });

    // 8) Re-order to match topIds
    const ordered = topIds
      .map(id => items.find(r => r.id === id))
      .filter(Boolean);

    res.json({ base, items: ordered });
  } catch (err) {
    console.error('GET /releases/recommended error:', err);
    res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
});



// Start server
const port = process.env.BACKEND_PORT;
app.listen(port, () => {
  console.log(`🚀 API listening on ${process.env.BASE_URL}:${port}`);
});
