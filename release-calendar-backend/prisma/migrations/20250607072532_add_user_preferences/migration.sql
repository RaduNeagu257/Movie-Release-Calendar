-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferencesCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserPreferredGenres" (
    "userId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "UserPreferredGenres_pkey" PRIMARY KEY ("userId","genreId")
);

-- AddForeignKey
ALTER TABLE "UserPreferredGenres" ADD CONSTRAINT "UserPreferredGenres_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferredGenres" ADD CONSTRAINT "UserPreferredGenres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
