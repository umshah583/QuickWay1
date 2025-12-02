-- Fix for booking 692e6f89987689e56a702468
-- Sets driver location to simulate driver at Dubai Mall (7.5km from customer)

UPDATE "Booking" 
SET 
  "driverLatitude" = 25.1972,
  "driverLongitude" = 55.2744,
  "driverLocationUpdatedAt" = NOW()
WHERE id = '692e6f89987689e56a702468';

-- Verify the update
SELECT 
  id,
  "taskStatus",
  "customerLatitude",
  "customerLongitude",
  "driverLatitude",
  "driverLongitude",
  "driverLocationUpdatedAt"
FROM "Booking" 
WHERE id = '692e6f89987689e56a702468';
