const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Create User
exports.createUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    // Verify token
    admin.auth().verifyIdToken(tokenId)
      .then( decodedToken => (

        admin.auth().createUser({
          email: request.query.email,
          password: request.query.password,
        })

      )).then(userRecord => {

        return response.send(userRecord);

      }).catch(error => {

        response.status(400).send(error);

      });
  });
});

// Delete User
exports.deleteUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    admin.auth().verifyIdToken(tokenId)
      .then(decodedToken => {

        if (decodedToken.uid !== request.query.uid) {
          return admin.auth().deleteUser(request.query.uid)
        } else {
          // Cannot delete current user;
          return response.status(403).send('Cannot delete current user');
        }

      }).then(userRecord => {

        return response.send('Successfully deleted user');

      }).catch(error => {

        return response.status(400).send(error);

      });

  });
});

// Update User
exports.updateUser = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const tokenId = request.get('Authorization');

    admin.auth().verifyIdToken(tokenId)
      .then(decodedToken => (

        admin.auth().updateUser(request.query.uid, {
          email: request.query.email,
          password: request.query.password
        })

      )).then(userRecord => {

        return response.send('Successfully updated user');

      }).catch(error => {

        return response.status(400).send(error);

      });
  });
});
