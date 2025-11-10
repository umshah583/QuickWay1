-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "driverId" TEXT,
    "taskStatus" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "cashCollected" BOOLEAN NOT NULL DEFAULT false,
    "cashAmountCents" INTEGER DEFAULT 0,
    "driverNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("createdAt", "endAt", "id", "serviceId", "startAt", "status", "updatedAt", "userId") SELECT "createdAt", "endAt", "id", "serviceId", "startAt", "status", "updatedAt", "userId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE INDEX "Booking_userId_startAt_idx" ON "Booking"("userId", "startAt");
CREATE INDEX "Booking_serviceId_startAt_idx" ON "Booking"("serviceId", "startAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
