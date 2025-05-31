/*
  Warnings:

  - The `rating` column on the `Watchlists` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('LIKE', 'DISLIKE');

-- AlterTable
ALTER TABLE "Watchlists" DROP COLUMN "rating",
ADD COLUMN     "rating" "Rating";
