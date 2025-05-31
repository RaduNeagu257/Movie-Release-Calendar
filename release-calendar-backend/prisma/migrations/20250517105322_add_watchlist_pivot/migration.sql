-- CreateTable
CREATE TABLE "Watchlists" (
    "userId" INTEGER NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlists_pkey" PRIMARY KEY ("userId","releaseId")
);

-- AddForeignKey
ALTER TABLE "Watchlists" ADD CONSTRAINT "Watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlists" ADD CONSTRAINT "Watchlists_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
