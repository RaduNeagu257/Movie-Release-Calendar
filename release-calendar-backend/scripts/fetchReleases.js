// scripts/fetchReleases.js
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  
  // Check if type includes 'movie' or 'tv'
  const isMovie = type.includes('movie'); // check if it's a movie type (discover/movie, movie/upcoming)
  const isTV = type.includes('tv');       // check if it's a TV type (tv/airing_today)

  for (const item of items) {
    // Use 'release_date' for movies, 'first_air_date' for TV shows
    const rawDate = isMovie ? item.release_date : (isTV ? item.first_air_date : null);

    // Skip if no valid date exists
    if (!rawDate) {
      console.log(`⚠️ Skipping item (no valid date): ${item.title || item.name}`);
      continue;
    }

    const releaseDate = new Date(rawDate);

    // Check if the date is valid
    if (isNaN(releaseDate)) {
      console.log(`⚠️ Invalid date for ${item.title || item.name}: ${rawDate}`);
      continue;
    }

    try {
      // Log the item being processed
      console.log(`Processing ${item.title || item.name} released on ${releaseDate}`);

      // Upsert movie or TV show into the database
      const release = await prisma.release.upsert({
        where: { tmdbId: item.id },
        create: {
          tmdbId:      item.id,
          title:       item.title || item.name,
          type:        isMovie ? 'movie' : (isTV ? 'tv' : 'unknown'),  // Correct type assignment (either 'movie' or 'tv')
          releaseDate,
          overview:    item.overview,
          posterPath:  item.poster_path,
        },
        update: {
          title:       item.title || item.name,
          releaseDate,
          overview:    item.overview,
          posterPath:  item.poster_path,
        },
      });

      /// Retrieve genreIds from the Genre table based on tmdbId
      const genreIds = await prisma.genre.findMany({
        where: {
          tmdbId: { in: item.genre_ids }  // Match genreIds using tmdbId
        },
        select: { id: true }  // Only return the genreId
      });

      // Create the genre connections for ReleaseGenre
      const genreConnections = genreIds.map((genre) => ({
        releaseId: release.id,  // Use the upserted releaseId
        genreId: genre.id,      // Use the genreId from the Genre table
      }));

      // First, check if any connections already exist
      const existingGenreConnections = await prisma.releaseGenre.findMany({
        where: {
          releaseId: release.id,
          genreId: { in: genreConnections.map(gc => gc.genreId) },
        },
      });

      // Filter out any existing genre connections
      const newGenreConnections = genreConnections.filter((gc) => 
        !existingGenreConnections.some((existing) => existing.genreId === gc.genreId)
      );

      // Only insert new genre connections
      if (newGenreConnections.length > 0) {
        await prisma.releaseGenre.createMany({
          data: newGenreConnections,
        });
        console.log(`🎬 Processed ${item.title || item.name} with ${newGenreConnections.length} new genres.`);
      } else {
        console.log(`No new genre connections for ${item.title || item.name}`);
      }

    } catch (error) {
      console.error(`Error processing ${item.title || item.name}:`, error);
    }
  }

  console.log(`✅ Finished processing ${items.length} items for ${type}`);
}




// Function to fetch data from TMDB for specific types and filters
async function fetchAndStore(type, params) {
  let page = 1, totalPages = 1;
  console.log(`📅 Fetching ${type} with filters:`, params);

  let totalResults = 0;
  while (page <= totalPages) {
    const { data } = await TMDB.get(`/${type}`, {
      params: { ...params, page },
    });
    totalPages = data.total_pages;
    if (totalResults === 0) {
      totalResults = data.total_results;
      console.log(`📊 Total results: ${totalResults}`);
    }
    await processItems(data.results, type);
    console.log(`✅ Processed page ${page}/${totalPages} for ${type}`);
    page++;
  }
}

// Main execution
async function main() {
  console.log('🚀 Seeding process started...');

  // 1) Clear old data and upsert genres
  await prisma.releaseGenre.deleteMany();
  await prisma.release.deleteMany();
  await prisma.genre.deleteMany();
  await upsertGenres('movie');
  await upsertGenres('tv');

  // 2) Fetch and seed movies from the past
  const movieParams = {
    include_adult: false,
    include_video: false,
    language: 'en-US',
    'primary_release_date.gte': '2000-01-01',  // Correct format with dots
    'primary_release_date.lte': '2025-04-29',  // Correct format with dots
    sort_by: 'primary_release_date.asc',
    'vote_average.gte': 2,  // Correct format with dots
    'vote_count.gte': 100,  // Correct format with dots
    with_original_language: 'en',
  };
  await fetchAndStore('discover/movie', movieParams);

  // 3) Fetch and seed upcoming movies
  await fetchAndStore('movie/upcoming', { language: 'en-US' });

  // 4) Fetch and seed TV shows airing today
  await fetchAndStore('tv/airing_today', { language: 'en-US' });

  console.log('🎉 All releases up to 2025 have been seeded.');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
