const { MongoClient } = require('mongodb');
const fs = require('fs');

// Path to your .pem certificate file
const pemFile = 'C:/Apache24/htdocs/X509-cert-219259406246793197.pem';

// MongoDB connection URI
const uri = 'mongodb+srv://coworkconnectcluster.rpz8r.mongodb.net/?retryWrites=true&w=majority&appName=CoworkConnectCluster';

async function run() {
    const amenitiesList = 'Wifi, Parking, Coffee, Tea';
    const amenitiesTranformed = amenitiesList ? amenitiesList.split(',').map(str => str.toLowerCase().trim().replace(/\s/g, '')) : [];
    console.log('amenitiesTranformed:', amenitiesTranformed);
}

run().catch(console.error);