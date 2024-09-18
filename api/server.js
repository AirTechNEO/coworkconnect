//-------------------------------------------------------------------------
// Load the required packages
//-------------------------------------------------------------------------


require('dotenv').config();
const express = require('express');                         
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const app = express();
const NodeCache = require('node-cache');
const amenitiesTagList = require('./amenitiesTagList.json');

const secretKey = fs.readFileSync('C:/Apache24/htdocs/private.pem', 'utf8');
const publicKey = fs.readFileSync('C:/Apache24/htdocs/public.pem', 'utf8');
const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 3000;// Default to port 3000 if not set
const queryCache = new NodeCache({ stdTTL: 600 }); // Cache with 10 minutes TTL (time to live)
const hostname = 'localhost';
const nbHourSlots = 12;


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.redirect(hostname);  
  });

//-------------------------------------------------------------------------
// Register and login routes
//-------------------------------------------------------------------------

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send({ error: 'Email and password are required' });
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const user = await getUserFromEmail(email);
        if (user) {
            console.error('Email already exists');
            return res.status(400).send({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { email, password: hashedPassword };

        await users.insertOne(newUser);
        const token = jwt.sign({"email": newUser.email}, secretKey, {algorithm: 'RS512', expiresIn: '24h'});
        res.status(201).send({ message: 'User registered', token});
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send({ error: 'Internal server error' });
    } finally {
        await client.close();
    }
});

app.post('/login', async (req, res) => {
    const {email, password} = req.body;
    if (!email || !password) {
        return res.status(400).send({ error: 'Email and password are required' });
    }
    const client = new MongoClient(uri);
    try {
        const user = await getUserFromEmail(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send({ error: 'Invalid username or password' });
        }
        const token = jwt.sign({email: user.email, id: user._id }, secretKey, {algorithm: 'RS512', expiresIn: '24h'});
        res.status(200).send({message: 'Login successful' ,token});
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send({ error: 'Internal server error'});
    } finally {
        await client.close();
    }
});

//-------------------------------------------------------------------------
// Main page query handler
//-------------------------------------------------------------------------

app.post('/', async (req, res) => {
    const {token, requestType, requestContent} = req.body;
    if (!token) {
        return res.status(401).json({ error: 'User is not logged in.' });
    }
    if (!requestType) {
        return res.status(400).json({ error: 'Request type is required.' });
    }
    const {valid,message,userEmail} = await verifyTokenAndUser(token);
    if (valid) {
        switch (requestType) {
            case 'rooms':
                console.log('Rooms request received');
                try{
                    const {pageNb, dateFrom, dateTo, roomSize, amenitiesTranformed, tagListTranformed} = getRoomRequestParameters(requestContent);
                    const result = await getAvailableRooms(pageNb, dateFrom, dateTo, roomSize, amenitiesTranformed, tagListTranformed);
                    return res.send(JSON.stringify(result));
                }
                catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'book':
                console.log('Booking request received');
                try{
                    const {roomId, nbPeople, startingDate, startingHour, duration} = requestContent;
                    if (!roomId || !nbPeople || !startingDate || !startingHour || !duration) {
                        return res.status(400).json({ error: 'All fields are required.' });
                    }
                    const result = await makeReservation(userEmail, roomId, nbPeople, startingDate, startingHour, duration);
                    return res.send(JSON.stringify(result));
                }
                catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'cancel':
                console.log('Cancellation request received');
                try {
                    const {bookingId} = requestContent;
                    const result = await cancelReservation(userEmail, bookingId);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'commentBooking':
                console.log('Comment booking request received');
                try {
                    const {bookingId, rating, comment} = requestContent;
                    const result = await commentBooking(userEmail, bookingId, rating, comment);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'bookingHistory':
                console.log('User\'s bookings history request received');
                try {
                    const {hasComment} = requestContent;
                    const result = await getUserBookings(userEmail,hasComment);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'updateUserInfo':
                console.log('Update user information request received');
                try {
                    const {currPassword, newPassword, newEmail, preferences} = requestContent;
                    const result = await updateUserInfo(userEmail, currPassword, newPassword, newEmail, preferences);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'getUserInfo':
                console.log('Get user information request received');
                try {
                    const result = await getUserInformation(userEmail);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            case 'getRoomInfo':
                console.log('Get room information request received');
                try {
                    const {roomId} = requestContent;
                    const result = await getRoomInformation(roomId);
                    return res.send(JSON.stringify(result));
                } catch (error) {
                    console.error(error);
                    return res.status(400).json({ error: error.message });
                }
            default:
                return res.status(400).json({error: 'Invalid request type'});
        }
    } else {
        res.status(401).json({error: message});
    }
});

//-------------------------------------------------------------------------
// Query route 1: Get available rooms
//-------------------------------------------------------------------------

async function getAvailableRooms(pageNb, dateFrom, dateTo, roomSize, amenitiesList, tagList) {
    let results;
    // Validate the parameters
    if (roomSize && isNaN(parseInt(roomSize, 10))) {
        throw new Error('Bad request: Room size must be an integer');
    }
    if (amenitiesList && (!Array.isArray(amenitiesList) || !amenitiesList.every(item => /^[a-zA-Z0-9_]+$/.test(item)))) {
        throw new Error('Bad request: List of amenities must be a list of strings separated by commas');
    }
    if (tagList && (!Array.isArray(tagList) || !tagList.every(item => /^[a-zA-Z0-9_]+$/.test(item)))) {
        throw new Error('Bad request: List of tags must be a list of strings separated by commas');
    }
    // Handle default pageNb value
    if (pageNb === undefined || pageNb === null || pageNb < 0) {
        pageNb = 0;
    }

    // Handle default dateFrom value
    const today = new Date();
    const defaultDateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (!dateFrom || (new Date(dateFrom) < defaultDateFrom)) {
        dateFrom = defaultDateFrom.toISOString().split('T')[0];
    }

    // Handle default dateTo value
    const defaultDateTo = new Date(defaultDateFrom.getTime() + (13 * 7 * 24 * 60 * 60 * 1000)); // 13 weeks from defaultDateFrom
    if (!dateTo || new Date(dateTo) > defaultDateTo) {
        dateTo = defaultDateTo.toISOString().split('T')[0];
    }

    // Generate a cache key based on the query parameters
    const cacheKey = JSON.stringify({ dateFrom, dateTo, roomSize, amenitiesList, tagList });

    // Check cache for the query results
    let cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
        console.log('Query results retrieved from cache');
        const startIndex = pageNb * 20;
        if (cachedResult.length > 1 && startIndex >= cachedResult.length) {
            throw new Error(`Requested page exceeds available entries: ${startIndex} >= ${cachedResult.length}`);
        }
        return {
            page: pageNb,
            totalPages: Math.ceil(cachedResult.length / 20),
            totalResults: cachedResult.length,
            results: cachedResult.slice(startIndex, startIndex + 20)
        };
    }

    // Fetch the results from the database
    results = await fetchAvailableRooms(dateFrom, dateTo, roomSize, amenitiesList, tagList);
    
    // Cache the full result set
    queryCache.set(cacheKey, results);
    // Paginate the results
    const startIndex = pageNb * 20;
    if (results.length > 0 && startIndex >= results.length) {
        throw new Error(`Requested page exceeds available entries: ${startIndex} >= ${results.length}`);
    }
    return {
        page: pageNb,
        totalPages: Math.ceil(results.length / 20),
        totalResults: results.length,
        results: results.slice(startIndex, startIndex + 20)
    };
}



//-------------------------------------------------------------------------
// Query route 2: Book a room
//------------------------------------------------------------------------- 

async function makeReservation(userEmail, roomId, nbPeople, startingDate, startingHour, duration){
    if (!userEmail || !roomId || !startingDate || isNaN(nbPeople) || isNaN(startingHour) || isNaN(duration) || startingHour < 0 || nbPeople <= 0 || duration <= 0) {
        return { error: 'All fields are required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const rooms = database.collection('roomInfo');
        const availabilities = database.collection('availabilities');
        const users = database.collection('userInfo');
        
        const user = await users.findOne({ email: userEmail });
        if (!user) {
            return { error: 'User not found' };
        }
        const roomIdObj = ObjectId.createFromHexString(roomId); 

        if (!await rooms.findOne({ _id: roomIdObj })) {
            return { error: 'Room not found' };
        }
        // Find all the availabilities for the given dayStart
        const endingHour = (startingHour + duration - 1) % 12;//-1 to account for the starting hour
        const nbDays = Math.ceil((parseInt(startingHour) + parseInt(duration)) / 12);
        var endingDate = new Date(startingDate);
        endingDate.setUTCDate(endingDate.getUTCDate() + nbDays);
        endingDate = endingDate.toISOString().split('T')[0];
        const allDays = await availabilities.aggregate(
            [
                {
                  $match: {
                    roomId: roomIdObj,
                    date: {$gte: startingDate, $lte: endingDate}
                  }
                },
                {
                  $sort: {
                    date: 1
                  }
                }
            ]
        ).toArray();
        if (!allDays || allDays.length === 0) {
            return { error: 'Given period is has no valid booking day.' };
        }
        if (allDays.length < nbDays) {
            return { error: 'Given period is too long for the room.' };
        }
        // Check the first day if all hours are available
        for (let i = startingHour; i < 12; i++) {
            if (allDays[0].hours[i] !== -1 || (allDays[0].hours[i] > 0 && allDays[0].hours[i] < nbPeople)) {
                return { error: `Not enough seats available for day ${allDays[0].date} at hour slot ${i}.` };
            }
        }
        // Check the middle days if all hours are available
        for (let i = 1; i < nbDays-1; i++) {
            for (let j = 0; j < 12; j++) {
                if (allDays[i].hours[j] !== -1 || (allDays[i].hours[j] > 0 && allDays[i].hours[j] < nbPeople)) {
                    return { error: `Not enough seats available for day ${allDays[i].date} at hour slot ${j}.` };
                }
            }
        }
        // Check the last day if all hours are available
        if (startingDate !== endingDate) {
            for (let i = 0; i <= endingHour; i++) {
                if (allDays[nbDays-1].hours[i] !== -1 || (allDays[nbDays-1].hours[i] > 0 && allDays[nbDays-1].hours[i] < nbPeople)) {
                    return { error: `Not enough seats available for day ${allDays[nbDays-1].date} at hour slot ${i}.` };
                }
            }
        }

        // If all checks pass, the booking can be made
        const reservation = {
            _id: new ObjectId(),
            "roomId":roomIdObj,
            "dateStart": startingDate,
            "dateEnd": endingDate,
            "timeStart":parseInt(startingHour),
            "timeEnd":parseInt(endingHour),
            "duration":parseInt(duration),
            "nbPeople":parseInt(nbPeople),
            "cancelled":false,
            "Comment":null,
        };
        // Add the booking to the user's bookings
        await users.updateOne({ email: userEmail }, { $push:{"Bookings": reservation }});
        
        // Update the availabilities collection to reflect the new booking
        // Update the first day
        for (let i = startingHour; i < 12; i++) {
            if (allDays[0].hours[i] !== -1) {
            allDays[0].hours[i] -= nbPeople;
            }
            else if (allDays[0].hours[i] === -1) {
            allDays[0].hours[i] = 0;
            }
        }
        await availabilities.updateOne(
            { _id: allDays[0]._id },
            { $set: { hours: allDays[0].hours } }
        );
        // Update the middle days
        for (let i = 1; i < nbDays - 1; i++) {
            for (let j = 0; j < 12; j++) {
                if (allDays[i].hours[j] !== -1) {
                    allDays[i].hours[j] -= nbPeople;
                } else if (allDays[i].hours[j] === -1) {
                    allDays[i].hours[j] = 0;
                }
            }
            await availabilities.updateOne(
                { _id: allDays[i]._id },
                { $set: { hours: allDays[i].hours } }
            );
        }
        // Update the last day
        for (let i = 0; i <= endingHour; i++) {
            if (allDays[nbDays - 1].hours[i] !== -1) {
                allDays[nbDays - 1].hours[i] -= nbPeople;
            } else if (allDays[nbDays - 1].hours[i] === -1) {
                allDays[nbDays - 1].hours[i] = 0;
            }
        }
        await availabilities.updateOne(
            { _id: allDays[nbDays - 1]._id },
            { $set: { hours: allDays[nbDays - 1].hours } }
        );

        queryCache.flushAll(); // Clear the cache to force a refresh of the room availability
        return { message: 'Reservation successful', reservation };
    } 
    catch (error) {
        console.error(error);
        return { "error":error };
    } 
    finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 3: Cancel a booking
//-------------------------------------------------------------------------

async function cancelReservation(userEmail, reservationId) {
    if (!userEmail || !reservationId) {
        return { error: 'All fields are required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const rooms = database.collection('roomInfo');
        const availabilities = database.collection('availabilities');
        const user = await users.findOne({ email: userEmail });
        if (!user) {
            return { error: 'User not found' };
        }
        const reservationIdObj = ObjectId.createFromHexString(reservationId);
        const reservationIndex = user.Bookings.findIndex(booking => booking._id.equals(reservationIdObj));
        if (reservationIndex === -1) {
            return { error: 'Reservation not found' };
        }
        const reservation = user.Bookings[reservationIndex];
        if (reservation.cancelled) {
            return { error: 'Reservation already cancelled' };
        }
        const today = new Date().toISOString().split('T')[0];
        if (reservation.dateEnd < today || (reservation.dateStart === today && reservation.timeEnd <= new Date().getHours() - 8)) {
            return { error: 'Cannot cancel past reservations' };
        }
        const roomIdObj = reservation.roomId;
        const room = await rooms.findOne({ _id: roomIdObj });
        if (!room) {
            return { error: 'Room not found' };
        }
        const allDays = await availabilities.aggregate(
            [
                {
                  $match: {
                    roomId: roomIdObj,
                    date:{$gte: today, $lte: reservation.dateEnd}
                  }
                },
                {
                  $sort: {
                    date: 1
                  }
                }
            ]
        ).toArray();
        // Update the first day
        const currentHour = parseInt(new Date().getHours());
        for (let i = (reservation.dateStart === today ? Math.max(currentHour - 8, reservation.timeStart) : reservation.timeStart); i < 12; i++) {
            if (room.tags[0]==="public") {
            allDays[0].hours[i] += reservation.nbPeople;
            } else if (room.tags[0]==="private") {
            allDays[0].hours[i] = -1;
            }
        }
        await availabilities.updateOne(
            { _id: allDays[0]._id },
            { $set: { hours: allDays[0].hours } }
        );
        // Update the middle days
        const nbDays = Math.ceil((parseInt(reservation.timeStart) + parseInt(reservation.duration)) / 12);
        for (let i = 1; i < nbDays - 1; i++) {
            for (let j = 0; j < 12; j++) {
                if (room.tags[0]==="public") {
                    allDays[i].hours[j] += reservation.nbPeople;
                } else if (room.tags[0]==="private") {
                    allDays[i].hours[j] = -1;
                }
            }
            await availabilities.updateOne(
                { _id: allDays[i]._id },
                { $set: { hours: allDays[i].hours } }
            );
        }
        // Update the last day
        for (let i = 0; i <= reservation.hourEnd; i++) {
            if (room.tags[0]==="public") {
                allDays[nbDays - 1].hours[i] += reservation.nbPeople;
            } else if (room.tags[0]==="private") {
                allDays[nbDays - 1].hours[i] = -1;
            }
        }
        await users.updateOne(
            { email: userEmail, 'Bookings._id': reservationIdObj },
            { $set: { 'Bookings.$.cancelled': true } }
        );
        
        return { message: 'Reservation cancelled successfully' };
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 4: Comment a booking
//-------------------------------------------------------------------------

async function commentBooking(userEmail, reservationId, rating, comment) {
    if (!userEmail || !reservationId || !rating || !comment) {
        return { error: 'All fields are required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const user = await users.findOne({ email: userEmail });
        if (!user) {
            return { error: 'User not found' };
        }
        const reservationIdObj = ObjectId.createFromHexString(reservationId);
        const reservationIndex = user.Bookings.findIndex(booking => booking._id.equals(reservationIdObj));
        if (reservationIndex === -1) {
            return { error: 'Reservation not found' };
        }
        const reservation = user.Bookings[reservationIndex];
        if (reservation.Comment) {
            return { error: 'Reservation already commented' };
        }
        const oddComFlag = (reservation.Comment.includes('http://') || reservation.Comment.includes('https://')) ||
                          (reservation.Comment.match(/[@#$%^&*,.?{}|<>]/g) || []).length > 3 ||
                          reservation.Comment.split(' ').length > 100;
        await users.updateOne(
            { email: userEmail, 'Bookings._id': reservationIdObj },
            { $set: { 'Bookings.$.Comment': { _id:new ObjectId(), rating, comment, oddComFlag } } }
        );
        return { message: 'Comment added successfully' };
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 5: Update user information
//-------------------------------------------------------------------------

async function updateUserInfo(userEmail, currPassword, newPassword, newEmail, preferences) {
    if (!currPassword) {
        return { error: 'User password not provided' };
    }
    if (!newEmail && !preferences && !newPassword) {
        return { error: 'No new information provided' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const user = await users.findOne({ email: userEmail });

        //Verify given data
        if (!user) {
            return { error: 'User not found' };
        }
        if (!(await bcrypt.compare(currPassword, user.password))) {
            return { error: 'Invalid password' };
        }
        if (newEmail && newEmail !== userEmail && 
            ( !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) ) &&
            await users.findOne({ email: newEmail })) {
            return { error: 'Invalid new email' };
        }
        if (newPassword && newPassword === currPassword) {
            return { error: 'New password must be different from the current password' };
        }
        if (preferences && !Array.isArray(preferences) && preferences.some(preference => typeof preference !== 'string')) {
            return { error: 'Preferences must be an array of strings' };
        }


        //Modify the data
        if (newEmail) {
            await users.updateOne({ email: userEmail }, { $set: { email: newEmail } });
        }
        if (newPassword) {
            await users.updateOne({ email: userEmail }, { $set: { password: await bcrypt.hash(newPassword, 10) } });
        }
        if (preferences) {
            await users.updateOne({ email: userEmail }, { $set: { preferences } });
        }
        return { message: 'User information updated successfully' };
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 6: Get user information
//-------------------------------------------------------------------------

async function getUserInformation(userEmail) {
    if (!userEmail) {
        return { error: 'Email is required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const user = await users.findOne({ email: userEmail });
        if (!user) {
            return { error: 'User not found' };
        }
        return { email: user.email, preferences: user.preferences };
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 7: Get user bookings
//-------------------------------------------------------------------------

async function getUserBookings(userEmail, hasComment) {
    if (!userEmail) {
        return { error: 'Email is required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        const user = await users.findOne({ email: userEmail });
        if (!user) {
            return { error: 'User not found' };
        }
        if (hasComment) {
            return await user.Bookings.filter(booking => booking.Comment);
        }
        return await user.Bookings;
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Query route 8: Get room information 
//-------------------------------------------------------------------------

async function getRoomInformation(roomId) {
    if (!roomId) {
        return { error: 'Room ID is required' };
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const rooms = database.collection('roomInfo');
        const room = await rooms.findOne({ _id: ObjectId.createFromHexString(roomId) });
        if (!room) {
            return { error: 'Room not found' };
        }
        return room;
    } catch (error) {
        console.error(error);
        return { error };
    } finally {
        await client.close();
    }
}

//-------------------------------------------------------------------------
// Function definitions
//-------------------------------------------------------------------------


async function makeUserAdvising(userEmail, dateFrom, dateTo, roomSize, amenitiesList, tagList) {
    //First, we get the user preferences
    const user = getUserFromEmail(userEmail);
    const preferences = user.preferences;
    if (!preferences) {
        return { message: 'Preferences not set, defaulting to get the available rooms.' , 
            result: await getAvailableRooms(0, dateFrom, dateTo, roomSize, amenitiesList, tagList)};
    }
    //Second, we make the request to get the available rooms
    const rooms = fetchAvailableRooms(dateFrom, dateTo, null, null, null);
    //Then, we use a regression function to predict which room is the best for the user
    if (rooms.totalResults === 0) {
        return { error: 'No rooms available' };
    }
    const bestRooms = orderAdvising(preferences,rooms.results);
    return bestRooms;
}

function orderAdvising (userPreferences,rooms) {
    // This function will take the json object with the rooms and order them by the best for the user

    // Room scoring function
    const allTags = amenitiesTagList.amenities.concat(amenitiesTagList.tags);
    rooms.forEach(room => {
        room.Score = 0; // Initialize score
        // Compare user's preferences with room's amenities
        userPreferences.forEach(preference => {
            if (allTags.includes(preference) && (room.amenities.includes(preference) || room.tags.includes(preference))) {
                room.Score += 1; // Add a score for each matching preference
                if ((preference === 'private' && room.tags.includes('private')) || (preference === 'public' && room.tags.includes('public'))) {
                    room.Score += 1; // Add an additional score if the user prefers the room type
                }
            }
        });
         // Apply a linear malus if room size is less than a tenth of the requested size
        min = room.size / 10;
        max = room.size;
        n = roomSize > room.size ? 0 : (roomSize < room.size / 10 ? 1 : (roomSize - min) / (max - min));
        room.Score -= n*min + (1-n)*max; 
        // Additional scoring logic can be added here if needed
    });

    // Sort rooms by score (highest to lowest)
    const sortedRooms = rooms.sort((a, b) => b.Score - a.Score);

    // Return a list with the rooms ordered by their score
    return sortedRooms.map(room => ({ score: room.Score, room }));
}

async function fetchAvailableRooms(dateFrom, dateTo, roomSize, amenitiesList, tagList) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const availabilities = database.collection('availabilities');

        // Aggregation pipeline 
        const pipeline = [
            {
                $match: {
                    date: {
                        $gte: dateFrom,
                        $lte: dateTo
                    }
                }
            },
            {
                $group: {
                    _id: "$roomId",
                    allHours: {
                        $push: "$hours"
                    }
                }
            },
            {
                $addFields: {
                    concatenatedHours: {
                        $reduce: {
                            input: "$allHours",
                            initialValue: [],
                            in: {
                                $concatArrays: ["$$value", "$$this"]
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    concatenatedHours: {
                        $elemMatch: {
                            $ne: 0
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    roomId: "$_id"
                }
            },
            {
                $lookup: {
                    from: "roomInfo",
                    localField: "roomId",
                    foreignField: "_id",
                    as: "roomDetails"
                }
            },
            {
                $project: {
                    roomInfo: "$roomDetails"
                }
            },
            {
                $unwind: "$roomInfo"
            },
            {
                $replaceRoot: {
                    newRoot: "$roomInfo"
                }
            },
            {
                $match: {
                    size: { $gte: roomSize ? parseInt(roomSize) : 0 },
                    amenities: amenitiesList ? { $all: amenitiesList } : { $exists: true },
                    tags: tagList ? { $all: tagList } : { $exists: true }
                }
            }
        ];
        // Execute the aggregation
        return await availabilities.aggregate(pipeline).toArray();
    } finally {
        await client.close();
    }
}

function validateDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function validateStrList(list) {
    if (!list) {
        return false;
    }
    return /^[a-zA-Z0-9_,]+$/.test(list);
}

function getRoomRequestParameters(requestContent) {
    const {pageNb, dateFrom, dateTo, roomSize, amenitiesList, tagList} = requestContent;
    // Validate the parameters and transform them if necessary
    if (pageNb && isNaN(parseInt(pageNb, 10))) {
        throw new Error('Bad request: Page number must be an integer');
    }
    if (roomSize && isNaN(parseInt(roomSize, 10))) {
        throw new Error('Bad request: Room size must be an integer');
    }
    if (dateFrom && !validateDate(dateFrom)) {
        throw new Error('Bad request: Date from must be in YYYY-MM-DD format');
    }
    if (dateTo && !validateDate(dateTo)) {
        throw new Error('Bad request: Date to must be in YYYY-MM-DD format');
    }
    if (dateFrom && dateTo) {
        const formattedDateFrom = new Date(dateFrom);
        const formattedDateTo = new Date(dateTo);
        if (formattedDateFrom.getTime() > formattedDateTo.getTime()) {
            throw new Error('Bad request: Date from cannot be ahead of Date to');
        }
    }
    if (amenitiesList && !validateStrList(amenitiesList)) {
        throw new Error('Bad request: List of amenities must be a list of strings separated by commas');
    }
    const amenitiesTranformed = amenitiesList ? amenitiesList.split(',').map(str => str.toLowerCase().trim().replace(/\s/g, '')).filter(str => str !== '') : null;
    if (tagList && !validateStrList(tagList)) {
        throw new Error('Bad request: List of styles must be a list of strings separated by commas');
    }
    const tagListTranformed = tagList ? tagList.split(',').map(str => str.toLowerCase().trim().replace(/\s/g, '')).filter(str => str !== '') : null;
    return { pageNb, dateFrom, dateTo, roomSize, amenitiesTranformed, tagListTranformed };
} //

async function getUserFromEmail(email) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('coworkconnect');
        const users = database.collection('userInfo');
        return await users.findOne({email});
    } finally {
        await client.close();
    }
} //

async function verifyTokenAndUser(token) {
    try {
        const decoded = jwt.verify(token, publicKey, { algorithms: ['RS512'] });
        // Extract user email from the token
        const userEmail = decoded.email;
        
        // Query the database to check if the user exists and is valid
        return getUserFromEmail(userEmail).then(email => {
            const isEmailValid = getUserFromEmail(email) ? true : false;
            if (email && isEmailValid) {
                return { valid: true, userEmail };
            } else {
                return { valid: false, message: 'Invalid user' };
            }
        }).catch(err => {
            return { valid: false, message: 'Error querying user' };
        });
    } catch (err) {
        return { valid: false, message: 'Invalid token' };
    }
} //

// app.listen(port, () => {
//     console.log(`Server is running at http://localhost:${port}`);
// });

module.exports = {
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
  };