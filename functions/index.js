const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Create User
exports.createUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    admin.auth().createUser({
      email: request.query.email,
      password: request.query.password,
      uid: request.query.uid,
    })
    .then(userRecord => {
      response.send(userRecord);
    })
    .catch(error => {
      response.send('Error creating new user:' + error);
    });
  });
});

// Delete User
exports.deleteUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    admin.auth().deleteUser(request.query.uid)
    .then(userRecord => {
      response.send('Successfully deleted user');
    })
    .catch(error => {
      response.send('Error deleting user:' + error);
    });
  });
});

// Update User
exports.updateUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    admin.auth().updateUser(request.query.uid, {
      email: request.query.email,
      password: request.query.password
    })
    .then(userRecord => {
      response.send('Successfully updated user');
    })
    .catch(error => {
      response.send('Error updating user:' + error);
    });
  });
});
