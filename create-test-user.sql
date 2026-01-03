INSERT INTO User (id, email, passwordHash, name, phoneNumber, role, createdAt, updatedAt)
VALUES ('test-user-id', 'testuser@example.com', '$2a$10$example.hash', 'Test User', '+971501234567', 'USER', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  passwordHash = VALUES(passwordHash),
  name = VALUES(name),
  phoneNumber = VALUES(phoneNumber),
  role = VALUES(role);
