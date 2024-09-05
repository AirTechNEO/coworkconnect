require('dotenv').config();
const express = require('express');                         
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const uri = process.env.MONGODB_URI;

const cors = require('cors');
const app = express();
const port = 3000;  

app.use(cors());
app.use(express.json());

const { ObjectId } = require('mongodb');

function generateRandomRoomEntry() {
    // Helper functions
    const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomItem = (array) => array[getRandomInt(0, array.length - 1)];
    const getRandomItems = (array, count) => {
        const shuffled = array.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };
    const generateDate = (nb) => {
        const date = new Date();
        date.setDate(date.getDate() + nb); // Add nb days to the current date to get the new date
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    };
    const generateAvailabilities = (id,rand) => {
        const availabilities = [];
        for (let i = 1; i < 92; i++) { // Generates 91 days of availabilities
            const date = generateDate(i);
            const hours = [];
            for (let j = 0; j < 12; j++) {
                hours.push(rand);
            }
            const newAvId = new ObjectId();
            availabilities.push({_id:newAvId, roomId:id, 'date':date, hours });
        }
        return availabilities;
    };

    // Sample data pools
    const amenitiesPool = ['wifi', 'projector', 'whiteboard', 'air_conditioning', 'coffee_machine'];
    const tagsPool = ['modern', 'cozy', 'bright', 'spacious', 'quiet'];
    // Generate the availability
    // Generate the room entry
    const nb = getRandomInt(5, 25);
    const rand = Math.random() < 0.65 ? -1 : nb; 
    const newId = new ObjectId();
    const availabilities = generateAvailabilities(newId,rand);

    const roomEntry = {
        _id: newId,
        roomNum: getRandomInt(1, 500),
        buildingId: 0,
        goodRatingNb: getRandomInt(0, 100),
        badRatingNb: getRandomInt(0, 50),
        size: getRandomInt(25, 300), // Random size between 10 and 100
        size: Math.round(30 + (Math.pow(Math.random(), 2) * 270)),
        nbSeatAvai: nb,
        desc: `This is a ${getRandomItem(tagsPool)} room with ${getRandomItems(amenitiesPool, 2).join(' and ')}.`,
        amenities: getRandomItems(amenitiesPool, getRandomInt(1, amenitiesPool.length)),
        img: null, // Images remain null
        tags: [rand > 0 ? 'public' : 'private', ...getRandomItems(tagsPool, getRandomInt(1, tagsPool.length))]
    };
    return {roomEntry,availabilities};
}
async function run(){
    const client = new MongoClient(uri);
    try {
        client.connect();
        const database = client.db('coworkconnect');
        const rooms = database.collection('roomInfo');
        const availabilitiesCollection = database.collection('availabilities');
        if (!rooms || !availabilitiesCollection) {
            throw new Error('Collection not found');
        }   
        rooms.deleteMany({}); // Clear the collection
        availabilitiesCollection.deleteMany({}); // Clear the collection
        for (let i = 0; i < 9; i++){
            const {roomEntry,availabilities}= generateRandomRoomEntry();
            rooms.insertOne(roomEntry);
            availabilitiesCollection.insertMany(availabilities);
        }
        console.log('Random rooms entry added');
    } catch (err) {
        console.error('Error connecting to the database', err);  
    } finally {
        client.close();
    }
}
run().catch(console.dir);