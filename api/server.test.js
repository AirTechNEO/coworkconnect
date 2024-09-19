require('dotenv').config({});
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { MongoClient,ObjectId } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NodeCache = require('node-cache');
const bcrypt = require('bcrypt');
const { 
  getUserFromEmail,
  getAvailableRooms,
  makeReservation,
  cancelReservation,
  commentBooking,
  getUserBookings,
  updateUserInfo,
  getUserInformation,
  getRoomInformation,
  validateDate,
  validateStrList,
  getRoomRequestParameters,
  verifyTokenAndUser
} = require('./server.js');
const { describe } = require('node:test');

const secretKey = fs.readFileSync('C:/Apache24/htdocs/private.pem', 'utf8');
const publicKey = fs.readFileSync('C:/Apache24/htdocs/public.pem', 'utf8');
const testUri = "mongodb://localhost:27017";


let connection;
let db;
let mongod;

jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(() => undefined),
    set: jest.fn(),
    flushAll: jest.fn(),
  }));
});

delete require.cache[require.resolve('dotenv')];

describe('getUserFromEmail', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  
    connection = await MongoClient.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  
    db = connection.db('coworkconnect');
  });
  
  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });
  
  afterEach(async () => {
    await db.collection('userInfo').deleteMany({});
    await db.collection('availabilities').deleteMany({});
  });
  it('should return the user document for a valid email', async () => {
    const users = db.collection('userInfo');
    const mockUser = { email: 'test@example.com', password: await bcrypt.hash('1234', 10) };
    await users.insertOne(mockUser);

    const result = await getUserFromEmail('test@example.com');

    expect(result).toEqual(mockUser);
  });

  it('should return null if no user is found', async () => {
    const result = await getUserFromEmail('nonexistent@example.com');

    expect(result).toBeNull();
  });
});

describe('verifyTokenAndUser', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  
    connection = await MongoClient.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  
    db = connection.db('coworkconnect');
  });
  
  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });
  
  afterEach(async () => {
    await db.collection('userInfo').deleteMany({});
    await db.collection('availabilities').deleteMany({});
  });
  it('should return valid and userEmail for a valid token', async () => {
    const users = db.collection('userInfo');
    const mockUser = { email: 'test@example.com', password: await bcrypt.hash('1234', 10) };
    await users.insertOne(mockUser);

    const token = jwt.sign({ email: mockUser.email }, secretKey, { algorithm: 'RS512', expiresIn: '24h' });
    const result = await verifyTokenAndUser(token);

    expect(result.valid).toBe(true);
    expect(result.userEmail).toBe(mockUser.email);
  });

  it('should return invalid and error message for an invalid token', async () => {
    const invalidToken = jwt.sign({ email: 'invalid@example.com' }, 'invalidSecret', { algorithm: 'HS256', expiresIn: '24h' });
    const result = await verifyTokenAndUser(invalidToken);

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Invalid token');
  });
});

describe('getRoomRequestParameters', () => {
  it('should throw an error for invalid pageNb', () => {
    const requestContent = { pageNb: 'invalid' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: Page number must be an integer');
  });

  it('should throw an error for invalid roomSize', () => {
    const requestContent = { roomSize: 'invalid' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: Room size must be an integer');
  });

  it('should throw an error for invalid dateFrom', () => {
    const requestContent = { dateFrom: 'invalid-date' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: Date from must be in YYYY-MM-DD format');
  });

  it('should throw an error for invalid dateTo', () => {
    const requestContent = { dateTo: 'invalid-date' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: Date to must be in YYYY-MM-DD format');
  });

  it('should throw an error if dateFrom is ahead of dateTo', () => {
    const requestContent = { dateFrom: '2023-01-10', dateTo: '2023-01-01' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: Date from cannot be ahead of Date to');
  });

  it('should throw an error for invalid amenitiesList', () => {
    const requestContent = { amenitiesList: 'wifi,projector!' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: List of amenities must be a list of strings separated by commas');
  });

  it('should throw an error for invalid tagList', () => {
    const requestContent = { tagList: 'conference,meeting!' };

    expect(() => getRoomRequestParameters(requestContent)).toThrow('Bad request: List of styles must be a list of strings separated by commas');
  });
});

describe('validateDate', () => {
  it('should return true for a valid date string', () => {
    const result = validateDate('2023-01-01');
    expect(result).toBe(true);
  });

  it('should return false for an invalid date string', () => {
    const result = validateDate('invalid-date');
    expect(result).toBe(false);
  });

  it('should return false for an empty string', () => {
    const result = validateDate('');
    expect(result).toBe(false);
  });

  it('should return false for a null value', () => {
    const result = validateDate(null);
    expect(result).toBe(false);
  });
});

describe('validateStrList', () => {
  it('should return true for a valid string list', () => {
    const result = validateStrList('wifi,projector');
    expect(result).toBe(true);
  });

  it('should return false for an invalid string list containing special characters', () => {
    const result = validateStrList('wifi,projector!');
    expect(result).toBe(false);
  });

  it('should return false for an empty string', () => {
    const result = validateStrList('');
    expect(result).toBe(false);
  });

  it('should return false for a null value', () => {
    const result = validateStrList(null);
    expect(result).toBe(false);
  });
});

describe('getAvailableRooms', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await MongoClient.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  
    db = connection.db('coworkconnect');
  });
  
  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });
  
  afterEach(async () => {
    await db.collection('availabilities').deleteMany({});
  });
  it('should return available rooms for valid input', async () => {
    const availabilities = db.collection('availabilities');
    const roomInfo = db.collection('roomInfo');

    const mockRoom = { _id: new ObjectId(), size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await roomInfo.insertOne(mockRoom);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    const result = await getAvailableRooms(0, tomorrowStr, tomorrowStr, 10, ['wifi', 'projector'], ['conference', 'meeting']);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]._id).toEqual(mockRoom._id);
  });

  it('should default page to 0 if undefined, null, or negative', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const result1 = await getAvailableRooms(undefined, tomorrowStr, tomorrowStr, 10, ['wifi'], ['conference']);
    const result2 = await getAvailableRooms(null, tomorrowStr, tomorrowStr, 10, ['wifi'], ['conference']);
    const result3 = await getAvailableRooms(-1, tomorrowStr, tomorrowStr, 10, ['wifi'], ['conference']);

    expect(result1.page).toBe(0);
    expect(result2.page).toBe(0);
    expect(result3.page).toBe(0);
  });

  it('should give a correct query if dateFrom is undefined or earlier than default', async () => {
    const availabilities = db.collection('availabilities');
    const roomInfo = db.collection('roomInfo');
    const mockRoom = { _id: new ObjectId(), size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await roomInfo.insertOne(mockRoom);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    const result1 = await getAvailableRooms(0, undefined, tomorrowStr, 10, ['wifi'], ['conference']);
    const result2 = await getAvailableRooms(0, '2022-01-01', tomorrowStr, 10, ['wifi'], ['conference']);

    expect(result1.results).toHaveLength(1);
    expect(result2.results).toHaveLength(1);
  });

  it('should give a correct query if dateTo is undefined or later than 13 weeks from tomorrow', async () => {
    const availabilities = db.collection('availabilities');
    const roomInfo = db.collection('roomInfo');
    const mockRoom = { _id: new ObjectId(), size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await roomInfo.insertOne(mockRoom);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    const result1 = await getAvailableRooms(0, tomorrowStr, undefined, 10, ['wifi'], ['conference']);
    const result2 = await getAvailableRooms(0, tomorrowStr, '2026-01-01', 10, ['wifi'], ['conference']);

    expect(result1.results).toHaveLength(1);
    expect(result2.results).toHaveLength(1);
  });

  it('should throw an error for invalid roomSize', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await expect(getAvailableRooms(0, tomorrowStr, tomorrowStr, 'invalid', ['wifi'], ['conference']))
      .rejects
      .toThrow('Bad request: Room size must be an integer');
  });

  it('should throw an error for invalid amenitiesList', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await expect(getAvailableRooms(0, tomorrowStr, tomorrowStr, 10, ['wifi!'], ['conference']))
      .rejects
      .toThrow('Bad request: List of amenities must be a list of strings separated by commas');
  });

  it('should throw an error for invalid tagList', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await expect(getAvailableRooms(0, tomorrowStr, tomorrowStr, 10, ['wifi'], ['conference!']))
      .rejects
      .toThrow('Bad request: List of tags must be a list of strings separated by commas');
  });
});

describe('makeReservation', () => {
  let users, rooms, availabilities;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await MongoClient.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db('coworkconnect');
    users = db.collection('userInfo');
    rooms = db.collection('roomInfo');
    availabilities = db.collection('availabilities');
  });
  beforeEach(async () => {
    await users.deleteMany({});
    await rooms.deleteMany({});
    await availabilities.deleteMany({});
  });

  it('should successfully make a reservation', async () => {
    const mockUser = { email: 'test@example.com', password: await bcrypt.hash('1234', 10) };
    mockRoomId = new ObjectId();
    const mockRoom = { _id: mockRoomId, size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await users.insertOne(mockUser);
    await rooms.insertOne(mockRoom);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    const result = await makeReservation(mockUser.email, mockRoomId.toHexString(), 5, tomorrowStr, 0, 2);

    expect(result.message).toBe('Reservation successful');
    expect(result.reservation).toHaveProperty('_id');
    expect(result.reservation).toHaveProperty('roomId', mockRoom._id);
  });

  it('should return error for missing parameters', async () => {
    const result = await makeReservation(null, null, null, null, null, null);
    expect(result.error).toBe('All fields are required');
  });

  it('should return error for non-existent room', async () => {
    const mockUser = { email: 'test@example.com', password: await bcrypt.hash('1234', 10) };
    await users.insertOne(mockUser);

    const result = await makeReservation(mockUser.email, new ObjectId().toHexString(), 5, '2023-01-01', 0, 2);
    expect(result.error).toBe('Room not found');
  });

  it('should return error for non-existent user', async () => {
    const mockRoom = { _id: new ObjectId(), size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await rooms.insertOne(mockRoom);

    const result = await makeReservation('nonexistent@example.com', mockRoom._id.toHexString(), 5, '2023-01-01', 0, 2);
    expect(result.error).toBe('User not found');
  });

  it('should return error for insufficient availability', async () => {
    const mockUser = { email: 'test@example.com', password: await bcrypt.hash('1234', 10) };
    const mockRoom = { _id: new ObjectId(), size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await users.insertOne(mockUser);
    await rooms.insertOne(mockRoom);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(5) };
    await availabilities.insertOne(mockAvailability);

    const result = await makeReservation(mockUser.email, mockRoom._id.toHexString(), 10, tomorrowStr, 0, 2);
    expect(result.error).toContain('Not enough seats available');
  });
});

describe('cancelReservation', () => {
  let users, rooms, availabilities;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await MongoClient.connect(testUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = connection.db('coworkconnect');
    users = db.collection('userInfo');
    rooms = db.collection('roomInfo');
    availabilities = db.collection('availabilities');
  });

  beforeEach(async () => {
    await users.deleteMany({});
    await rooms.deleteMany({});
    await availabilities.deleteMany({});
  });

  afterAll(async () => {
    await connection.close();
    await mongod.stop();
  });

  it('should successfully cancel an existing reservation', async () => {
    // Arrange: Set up the necessary preconditions and inputs.
    const mockUser = { email: 'user@example.com', password: await bcrypt.hash('1234', 10) };
    const mockRoomId = new ObjectId();
    const mockRoom = { _id: mockRoomId, size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await users.insertOne(mockUser);
    await rooms.insertOne(mockRoom);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    const reservationResult = await makeReservation(mockUser.email, mockRoomId.toHexString(), 5, tomorrowStr, 0, 2);
    const reservationId = reservationResult.reservation._id.toHexString();

    // Act: Call the function under test.
    const cancelResult = await cancelReservation(mockUser.email, reservationId);

    // Assert: Verify the result.
    expect(cancelResult.message).toBe("Reservation cancelled successfully");

    // Verify the reservation was actually cancelled.
    const reservation = await db.collection('reservations').findOne({ _id: new ObjectId(reservationId) });
    expect(reservation).not.toBeNull();
    expect(reservation.cancelled).toBe(true);
  });

  it('should return false when trying to cancel a non-existent reservation', async () => {
    // Arrange: Set up the necessary preconditions and inputs.
    const mockUser = { email: 'user@example.com', password: await bcrypt.hash('1234', 10) };
    const mockRoomId = new ObjectId();
    const mockRoom = { _id: mockRoomId, size: 10, amenities: ['wifi', 'projector'], tags: ['conference', 'meeting'] };
    await users.insertOne(mockUser);
    await rooms.insertOne(mockRoom);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const mockAvailability = { roomId: mockRoom._id, date: tomorrowStr, hours: Array(12).fill(-1) };
    await availabilities.insertOne(mockAvailability);

    await makeReservation(mockUser.email, mockRoomId.toHexString(), 5, tomorrowStr, 0, 2);
    const reservationId = new ObjectId().toHexString();

    // Act: Call the function under test.
    const result = await cancelReservation(email, reservationId);

    // Assert: Verify the result.
    expect(result.error).toBe("Reservation not found");
  });

  it('should throw an error when given a null reservation ID', async () => {
    // Arrange: Set up the necessary preconditions and inputs.
    const email = 'user@example.com';
    const reservationId = null;

    // Act & Assert: Call the function under test and verify it throws an error.
    await expect(cancelReservation(email, reservationId)).rejects.toThrow('All fields are required');
  });

  it('should throw an error when given a null email', async () => {
    // Arrange: Set up the necessary preconditions and inputs.
    const email = null;
    const reservationId = new ObjectId().toHexString();

    // Act & Assert: Call the function under test and verify it throws an error.
    await expect(cancelReservation(email, reservationId)).rejects.toThrow('All fields are required');
  });

  it('should throw an error when given a null email and reservation ID', async () => {
    // Arrange: Set up the necessary preconditions and inputs.
    const email = null;
    const reservationId = null;

    // Act & Assert: Call the function under test and verify it throws an error.
    await expect(cancelReservation(email, reservationId)).rejects.toThrow('All fields are required');
  });
});