const token = localStorage.getItem('token');
const hostname = window.location.hostname;

document.addEventListener("DOMContentLoaded", function() {
    //First section: Get all the rooms available depending on the user's
    console.log('Stored information:',localStorage);
    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");
    const roomSize = document.getElementById("roomSize");
    const amenitiesList = document.getElementById("amenitiesList");
    const availableRoomsRequest = document.getElementById("availableRoomsRequest");
    const tagList = document.getElementById("tagList");
    const pageNb = document.getElementById("pageNb");
    availableRoomsRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        availableRooms(pageNb.value, dateFrom.value, dateTo.value, roomSize.value, amenitiesList.value, tagList.value)
    });  
    //Second section: Book a room
    const bookingRoomId = document.getElementById("bookingRoomId");
    const bookingNbPeople = document.getElementById("bookingNbPeople");
    const bookingDate = document.getElementById("bookingDate");
    const bookingHour = document.getElementById("bookingHour");
    const bookingDuration = document.getElementById("bookingDuration");
    const bookingRequest = document.getElementById("bookingRequest");
    bookingRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        bookRoom(bookingRoomId.value, bookingNbPeople.value, bookingDate.value, bookingHour.value, bookingDuration.value);
    });
    //Third section: Cancel a booking
    const cancelBookingId = document.getElementById("commentBookingId");
    const cancelBookingRequest = document.getElementById("cancelBookingRequest");
    cancelBookingRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        cancelBooking(cancelBookingId.value);
    });

    //Fourth section: Make comment
    const commentBookingId = document.getElementById("commentBookingId");
    const commentText = document.getElementById("commentText");
    const commentRating = document.getElementById("commentRating");
    const makeCommentRequest = document.getElementById("makeCommentRequest");
    makeCommentRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        addComment(commentBookingId.value, commentRating.value, commentText.value);
    });
    //Five section: Update user's information
    const currentPasswordUpdateInfo = document.getElementById("currentPasswordUpdateInfo");
    const newPasswordUpdateInfo = document.getElementById("newPasswordUpdateInfo");
    const newEmailUpdateInfo = document.getElementById("newEmailUpdateInfo");
    const preferencesUpdateInfo = document.getElementById("preferencesUpdateInfo");
    const updateInfoRequest = document.getElementById("updateInfoRequest");
    updateInfoRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        updateUserInfo(currentPasswordUpdateInfo.value, newPasswordUpdateInfo.value, newEmailUpdateInfo.value, preferencesUpdateInfo.value);
    });

    //Seventh section: Get user's bookings
    const hasCommentBookingRequest = document.getElementById("hasCommentBookingRequest");
    const bookingListRequest = document.getElementById("bookingListRequest");
    bookingListRequest.addEventListener("click", () => {
        contentField.innerHTML = "Loading...";
        getUserBookings(hasCommentBookingRequest.value);
    });


});

async function availableRooms(pageNb, dateFrom, dateTo, roomSize, amenitiesList, tagList) {   
    const query = {
        "pageNb": pageNb,
        "dateFrom": dateFrom,
        "dateTo": dateTo,
        "roomSize": roomSize,
        "amenitiesList": amenitiesList,
        "tagList": tagList
    };

    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token,
            requestType: 'rooms',
            requestContent: query
        })
    };
    console.log('reqBody:', {"token":token, "requestType":"rooms", "requestContent":query});
    sendInfo(reqBody);
}

async function bookRoom(roomId, nbPeople, date, hour, duration) {
    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "token": token,
            "requestType": "book",
            "requestContent": {
                "roomId": roomId,
                "nbPeople": nbPeople,
                "startingDate": date,
                "startingHour": hour,
                "duration": duration
            }
        })
    };
    console.log('reqBody:', reqBody);
    sendInfo(reqBody);
}

async function cancelBooking(bookingId) {
    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "token": token,
            "requestType": "cancel",
            "requestContent": {
                "bookingId": bookingId
            }
        })
    };
    console.log('reqBody:', reqBody);
    sendInfo(reqBody);
}

async function addComment(bookingId, commentRating, commentText) {
    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "token": token,
            "requestType": "commentBooking",
            "requestContent": {
                "bookingId": bookingId,
                "rating": commentRating,
                "comment": commentText
            }
        })
    };
    console.log('reqBody:', reqBody);
    sendInfo(reqBody);
}

async function getUserBookings(hasComment) {
    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "token": token,
            "requestType": "bookingHistory",
            "requestContent": {hasComment}
        })
    };
    console.log('reqBody:', reqBody);
    sendInfo(reqBody);
}

async function updateUserInfo(currPassword, newPassword, newEmail, preferences) {
    const reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token,
            requestType: 'updateUserInfo',
            requestContent: {
                currPassword,
                newPassword,
                newEmail,
                preferences
            }
        })
    };
    console.log('reqBody:', reqBody);
    sendInfo(reqBody);
}

async function sendInfo(reqBody) {
    try {
        const response = await fetch(`http://${hostname}:3000`, reqBody);
        const result = await response.json();
        if (response.ok) {
            contentField.innerHTML = JSON.stringify(result);
        } else {
            contentField.innerHTML = JSON.stringify(result.error); // Display error message
        }
    } catch (error) {
        console.error('Error:', error);
    }
}




function clickButton() {
    const query = '{'+Field.value+'}';
    console.log('query:', query);
    const dbName = 'coworkconnect';
    const collectionName = 'building';
    const queryType = 'all'
    
    const result = fetch(`http://192.168.0.57:3000/getItem?query=${query}&dbName=${dbName}&collectionName=${collectionName}&queryType=${queryType}`)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            contentField.innerHTML = `Your request is:\n${JSON.stringify(data)}`;
        })
        .catch(error => console.error('Error:', error));
}
function refreshLayout() {
    // Force reflow
    document.body.style.display = 'none';
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';
}

window.addEventListener('resize', refreshLayout);