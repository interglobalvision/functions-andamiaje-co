const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Create User
exports.createUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    admin.auth().verifyIdToken(tokenId)
    .then(decodedToken => {
      admin.auth().createUser({
        email: request.query.email,
        password: request.query.password,
      })
      .then(userRecord => {
        response.send(userRecord);
      })
      .catch(error => {
        response.send('Error creating new user:' + error);
      });
    })
    .catch(error => {
      response.send('Error verifying token:' + error);
    });
  });
});

// Delete User
exports.deleteUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    admin.auth().verifyIdToken(tokenId)
    .then(decodedToken => {
      if (decodedToken.uid === request.query.uid) {
        // Cannot delete current user;
        response.status(403).send('Cannot delete current user');
      } else {
        admin.auth().deleteUser(request.query.uid)
        .then(userRecord => {
          response.send('Successfully deleted user');
        })
        .catch(error => {
          response.status(400).send('Error deleting user:' + error);
        });
      }
    })
    .catch(error => {
      response.status(400).send('Error verifying token:' + error);
    });
  });
});

// Update User
exports.updateUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    admin.auth().verifyIdToken(tokenId)
    .then(decodedToken => {
      admin.auth().updateUser(request.query.uid, {
        email: request.query.email,
        password: request.query.password
      })
      .then(userRecord => {
        response.send('Successfully updated user');
      })
      .catch(error => {
        response.status(400).send('Error updating user:' + error);
      });
    })
    .catch(error => {
      response.status(400).send('Error verifying token:' + error);
    });
  });
});
