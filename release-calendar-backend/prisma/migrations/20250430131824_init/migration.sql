-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('movie', 'tv');

-- CreateTable
CREATE TABLE "Release" (
    "id" SERIAL NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "overview" TEXT NOT NULL,
    "posterPath" TEXT,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" SERIAL NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseGenres" (
    "releaseId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "ReleaseGenres_pkey" PRIMARY KEY ("releaseId","genreId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_tmdbId_key" ON "Release"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_tmdbId_key" ON "Genre"("tmdbId");

-- AddForeignKey
ALTER TABLE "ReleaseGenres" ADD CONSTRAINT "ReleaseGenres_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseGenres" ADD CONSTRAINT "ReleaseGenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
