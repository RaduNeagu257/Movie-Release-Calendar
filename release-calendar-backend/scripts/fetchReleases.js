// scripts/fetchReleases.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const moment = require('moment');

const TMDB = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  params: { api_key: process.env.TMDB_API_KEY, language: 'en-US' },
});

// Ensure genres exist
async function upsertGenres(type) {
  console.log(`🎨 Upserting genres for ${type}...`);
  const { data } = await TMDB.get(`/genre/${type}/list`);
  for (const g of data.genres) {
    await prisma.genre.upsert({
      where: { tmdbId: g.id },
      create: { tmdbId: g.id, name: g.name },
      update: { name: g.name },
    });
  }
  console.log(`✅ Genres for ${type} upserted (${data.genres.length} total).`);
}

// Process a batch of items into the DB
async function processItems(items, type) {
  const itemsByDate = {};

  // Check if type includes 'movie' or 'tv'
  const isMovie = type.includes('movie');
  const isTV = type.includes('tv');

  for (const item of items) {
    const rawDate = isMovie ? item.release_date : (isTV ? item.first_air_date : null);

    if (!rawDate) continue; // Skip if no valid date exists
    const releaseDate = new Date(rawDate);

    if (isNaN(releaseDate)) continue; // Skip if the date is invalid

    // Group items by releaseDate (date format YYYY-MM-DD)
    const dateString = releaseDate.toISOString().split('T')[0]; // Format to YYYY-MM-DD
    if (!itemsByDate[dateString]) {
      itemsByDate[dateString] = [];
    }
    itemsByDate[dateString].push(item);
  }

  // Now process each date group and insert top 3 releases
  for (const date in itemsByDate) {
    // Sort items for the specific date by popularity descending
    const sortedItems = itemsByDate[date].sort((a, b) => b.popularity - a.popularity);

    // Select top 3 items (most popular)
    const top3Items = sortedItems.slice(0, 3);

    // Insert top 3 releases only
    for (const item of top3Items) {
      try {
        console.log(`Processing ${item.title || item.name} released on ${date}`);

        // Upsert release into the database
        const release = await prisma.release.upsert({
          where: { tmdbId: item.id },
          create: {
            tmdbId: item.id,
            title: item.title || item.name,
            type: isMovie ? 'movie' : (isTV ? 'tv' : 'unknown'),
            releaseDate: new Date(date),
            overview: item.overview,
            posterPath: item.poster_path,
          },
          update: {
            title: item.title || item.name,
            releaseDate: new Date(date),
            overview: item.overview,
            posterPath: item.poster_path,
          },
        });

        // Retrieve genreIds based on tmdbId from the Genre table
        const genreIds = await prisma.genre.findMany({
          where: {
            tmdbId: { in: item.genre_ids },
          },
          select: { id: true },
        });

        // Create genre associations for ReleaseGenre
        const genreConnections = genreIds.map((genre) => ({
          releaseId: release.id,
          genreId: genre.id,
        }));

        if (genreConnections.length > 0) {
          await prisma.releaseGenre.createMany({
            data: genreConnections,
          });
          console.log(`🎬 Processed ${item.title || item.name} with ${genreConnections.length} genre associations.`);
        } else {
          console.log(`No genre associations for ${item.title || item.name}`);
        }
      } catch (error) {
        console.error(`Error processing ${item.title || item.name}:`, error);
      }
    }
  }

  console.log(`✅ Finished processing ${items.length} items for ${type}`);
}





// Function to fetch data from TMDB for specific types and filters
async function fetchAndStore(type, params) {
  let page = 1, totalPages = 1;
  console.log(`📅 Fetching ${type} with filters:`, params);

  let totalResults = 0;
  const allItems = [];

  // Make requests and process them page by page
  while (page <= totalPages) {
    const { data } = await TMDB.get(`/${type}`, { params: { ...params, page } });
    totalPages = data.total_pages;

    if (totalResults === 0) {
      totalResults = data.total_results;
      console.log(`📊 Total results: ${totalResults}`);
    }

    allItems.push(...data.results); // Collect all items from each page
    console.log(`✅ Processed page ${page}/${totalPages} for ${type}`);
    page++;
  }

  // Now process the collected items for the specific year
  await processItems(allItems, type);
}

// Fetch releases for a specific year, broken into three parts
async function fetchReleasesForYear(year, type) {
  const periods = [
    { start: `${year}-01-01`, end: `${year}-03-31` },
    { start: `${year}-04-01`, end: `${year}-06-30` },
    { start: `${year}-07-01`, end: `${year}-09-30` },
    { start: `${year}-10-01`, end: `${year}-12-31` },
  ];

  // For each period (quarter of the year), make a request
  for (const period of periods) {
    let params = {
      include_adult: false,
      include_video: false,
      language: 'en-US',
      sort_by: 'popularity.desc',
      with_original_language: 'en',
    };

    if (type.includes('movie')) {
      // For Movies, use primary_release_date filters
      params['primary_release_date.gte'] = period.start;
      params['primary_release_date.lte'] = period.end;
    } else if (type.includes('tv')) {
      // For TV Shows, use first_air_date filters
      params['first_air_date.gte'] = period.start;
      params['first_air_date.lte'] = period.end;
      params['first_air_date_year'] = year; // To filter by the year of the first air date
    }

    // Fetch and store data for movies or TV shows for the current period
    await fetchAndStore(type, params);
    console.log(`✅ Finished fetching and processing releases for ${period.start} to ${period.end} (${type})`);
  }
}


// Main execution
async function main() {
  console.log(' Seeding process started...');

  // 1) Clear old data and upsert genres
  await prisma.watchlist.deleteMany();
  await prisma.releaseGenre.deleteMany();
  await prisma.release.deleteMany();
  await prisma.userPreferredGenre.deleteMany();
  await prisma.genre.deleteMany();


  await upsertGenres('movie');
  await upsertGenres('tv');
  
  const currentYear = moment().year();
  const previousYear = currentYear - 1;
  const nextYear = currentYear + 1;

  const types = ['discover/movie', 'discover/tv']; // movie and tv types

  for (const type of types) {
    // Fetch for each year and both movie and TV show types
    await fetchReleasesForYear(previousYear, type);  // Previous year
    await fetchReleasesForYear(currentYear, type);   // Current year
    await fetchReleasesForYear(nextYear, type);      // Next year
  }

  // // 2) Fetch and seed movies from the past
  // const movieParams = {
  //   include_adult: false,
  //   include_video: false,
  //   language: 'en-US',
  //   'primary_release_date.gte': `${previousYear}-01-01`,
  //   'primary_release_date.lte': `${nextYear}-12-31`,
  //   sort_by: 'popularity.desc',
  //   with_original_language: 'en',
  // };
  // await fetchAndStore('discover/movie', movieParams);

  // 3) Fetch and seed upcoming movies
  //await fetchAndStore('movie/upcoming', { language: 'en-US' });

  // 4) Fetch and seed TV shows airing today
  //await fetchAndStore('tv/airing_today', { language: 'en-US' });

  console.log('All releases for the past, present, and future years have been seeded.');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
