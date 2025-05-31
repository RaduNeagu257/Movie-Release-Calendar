-- AlterTable
ALTER TABLE "Watchlists" ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "watched" BOOLEAN NOT NULL DEFAULT false;
