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

async function processItems(items, type) {
  // Determine the correct type for movie or TV
  const isMovie = type.includes('movie'); // check if it's a movie type (discover/movie, movie/upcoming)
  const isTV = type.includes('tv');       // check if it's a TV type (tv/airing_today)

  for (const item of items) {
    // Depending on the type, use the correct release date field
    const rawDate = isMovie ? item.release_date : (isTV ? item.first_air_date : null);

    const releaseDate = new Date(`${rawDate}T00:00:00Z`);

    // Check if the date is valid
    if (isNaN(releaseDate)) {
      console.log(`⚠️ Invalid date for ${item.title || item.name}: ${rawDate}`);
      continue;
    }

    try {
      // Upsert movie or TV show into the database
      await prisma.release.upsert({
        where: { tmdbId: item.id },
        create: {
          tmdbId:      item.id,
          title:       item.title || item.name,
          type:        isMovie ? 'movie' : (isTV ? 'tv' : 'unknown'),  // Correct type assignment (either 'movie' or 'tv')
          releaseDate,
          overview:    item.overview,
          posterPath:  item.poster_path,
          genres:      { connect: item.genre_ids.map(id => ({ tmdbId: id })) },
        },
        update: {
          title:       item.title || item.name,
          releaseDate,
          overview:    item.overview,
          posterPath:  item.poster_path,
          genres: {
            set: [],
            connect: item.genre_ids.map(id => ({ tmdbId: id })),
          },
        },
      });
    } catch (error) {
      console.error(`Error processing ${item.title || item.name}:`, error);
    }
  }
}








// Function to fetch data from TMDB for specific types and filters
async function fetchAndStore(type, params) {
  let page = 1, totalPages = 1;
  console.log(`📅 Fetching ${type} with filters:`, params);

  while (page <= totalPages) {
    const { data } = await TMDB.get(`/${type}`, {
      params: { ...params, page },
    });
    totalPages = data.total_pages;
    await processItems(data.results, type);
    console.log(`✅ Processed page ${page}/${totalPages} for ${type}`);
    page++;
  }
}

// Main execution
async function main() {
  console.log('🚀 Seeding process started...');

  // 1) Clear old data and upsert genres
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
