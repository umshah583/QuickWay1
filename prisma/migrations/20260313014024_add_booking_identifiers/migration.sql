/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[orderNumber]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('CUSTOMER', 'DRIVER');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SystemEventType" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_ASSIGNED', 'BOOKING_STARTED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'BOOKING_PAYMENT_RECEIVED', 'BOOKING_PAYMENT_FAILED', 'DRIVER_ONLINE', 'DRIVER_OFFLINE', 'DRIVER_LOCATION_UPDATE', 'DRIVER_TASK_STARTED', 'DRIVER_TASK_COMPLETED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'DRIVER_CASH_COLLECTED', 'CUSTOMER_REGISTERED', 'CUSTOMER_LOCATION_CHANGED', 'SYSTEM_ERROR', 'SYSTEM_WARNING', 'SYSTEM_MAINTENANCE');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('BOOKING', 'DRIVER', 'CUSTOMER', 'PAYMENT', 'SYSTEM', 'TRACKING');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CUSTOMER', 'DRIVER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('LOCATION_UPDATE', 'TASK_START', 'TASK_COMPLETE', 'EN_ROUTE', 'ARRIVED', 'IDLE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "orderNumber" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentLatitude" DOUBLE PRECISION,
ADD COLUMN     "currentLongitude" DOUBLE PRECISION,
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "ChatSenderType" NOT NULL,
    "message" TEXT NOT NULL,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "eventType" "SystemEventType" NOT NULL,
    "category" "EventCategory" NOT NULL,
    "severity" "EventSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorType" "ActorType",
    "actorName" TEXT,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetRoles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "metadata" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_tracking_events" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "batteryLevel" DOUBLE PRECISION,
    "eventType" "TrackingEventType" NOT NULL DEFAULT 'LOCATION_UPDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_bookingId_key" ON "ChatConversation"("bookingId");

-- CreateIndex
CREATE INDEX "ChatConversation_customerId_driverId_idx" ON "ChatConversation"("customerId", "driverId");

-- CreateIndex
CREATE INDEX "ChatConversation_bookingId_idx" ON "ChatConversation"("bookingId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "Settings"("key");

-- CreateIndex
CREATE INDEX "system_events_eventType_createdAt_idx" ON "system_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "system_events_category_createdAt_idx" ON "system_events"("category", "createdAt");

-- CreateIndex
CREATE INDEX "system_events_entityType_entityId_idx" ON "system_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "system_events_actorId_idx" ON "system_events"("actorId");

-- CreateIndex
CREATE INDEX "system_events_processed_createdAt_idx" ON "system_events"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "live_tracking_events_bookingId_createdAt_idx" ON "live_tracking_events"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "live_tracking_events_driverId_createdAt_idx" ON "live_tracking_events"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_invoiceNumber_key" ON "Booking"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_orderNumber_key" ON "Booking"("orderNumber");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
