const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

exports.createUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    admin.auth().createUser({
      email: request.query.email,
      password: request.query.password,
      uid: request.query.uid,
    }).then(userRecord => {
      // See the UserRecord reference doc for the contents of userRecord.
      response.send(userRecord);
    })
    .catch(error => {
      response.send("Error creating new user:" + error);
    });
  });
});
