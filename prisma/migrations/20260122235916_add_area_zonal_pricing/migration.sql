/*
  Warnings:

  - You are about to drop the `EventLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventOutbox` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "areaName" TEXT;

-- DropTable
DROP TABLE "EventLog";

-- DropTable
DROP TABLE "EventOutbox";

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minLatitude" DOUBLE PRECISION NOT NULL,
    "maxLatitude" DOUBLE PRECISION NOT NULL,
    "minLongitude" DOUBLE PRECISION NOT NULL,
    "maxLongitude" DOUBLE PRECISION NOT NULL,
    "polygonJson" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAreaPrice" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "discountPercentage" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAreaPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");

-- CreateIndex
CREATE INDEX "Area_active_sortOrder_idx" ON "Area"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ServiceAreaPrice_serviceId_idx" ON "ServiceAreaPrice"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceAreaPrice_areaId_idx" ON "ServiceAreaPrice"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAreaPrice_serviceId_areaId_key" ON "ServiceAreaPrice"("serviceId", "areaId");

-- CreateIndex
CREATE INDEX "Booking_areaId_idx" ON "Booking"("areaId");

-- AddForeignKey
ALTER TABLE "ServiceAreaPrice" ADD CONSTRAINT "ServiceAreaPrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAreaPrice" ADD CONSTRAINT "ServiceAreaPrice_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
