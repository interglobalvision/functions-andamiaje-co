const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// Thumbs stuff
const gcs = require('@google-cloud/storage')();
const sharp = require('sharp')
const path = require('path');
const os = require('os');

const IMAGE_SIZES = require('./imageSizes');

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

exports.generateThumbnail = functions.storage.object('uploads/{imageId}').onChange(event => {

  console.log('EVENT', event);
  const object = event.data; // The Storage object.

  const fileBucket = object.bucket; // The Storage bucket that contains the file.
  const filePath = object.name; // File path in the bucket.
  const contentType = object.contentType; // File content type.
  const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).
  const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

  // Check mime type or if this is a move or deletion event
  if (!contentType.startsWith('image/') || resourceState === 'not_exists') {
    console.log('This is not an image.');
    return;
  }

  // Check if this is an already proccesed image
  if (filePath.includes('_thumb')) {
    console.log('already processed image');
    return;
  }

  /*
   * Example. if filePath is `uploads/pikachu_300_thumb.jpg`
   *
   * fileName: `pikachu.jpg`
   * extension: `jpg`
   * name: `pikachu`
   *
   */
  const fileName = filePath.split('/').pop();
  const extension = fileName.split('.').pop();
  const name = fileName.replace(/\.[^/.]+$/, "");

  const bucket = gcs.bucket(fileBucket);
  const file = bucket.file(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);

  file
    .download({
      destination: tempFilePath
    })
    .then(() => {
      // Array used to store promises
      let imagePromises = [];

      // We iterate sizes
      IMAGE_SIZES.forEach( size => {
        const { prefix, width, height } = size;

        let newFileName = `${name}_${prefix}_thumb.${extension}`
        let newFileTemp = path.join(os.tmpdir(), newFileName);
        let newFilePath = `uploads/${newFileName}`

        // We push promises to the array
        imagePromises.push( sharp(tempFilePath)
          .resize(width, height)
          .toFile(newFileTemp)
          .then( () => {
            // Upload to bucket
            return bucket.upload(newFileTemp, {
              destination: newFilePath
            });
          })
          .catch(error => console.error(error))
        );

      });

      // Return all promises. This means that the next `then()` wont't execute
      // until all promises are resolved
      return Promise.all(imagePromises);
    })
    .catch(error => console.error(error));
});

// acquire Lote
exports.acquireLote = functions.https.onRequest((request, response) => {
  cors(request, response, () => {

    // Get request params
    const loteId = request.query.lote || undefined;
    const tokenId = request.get('Authorization');

    let uid;

    // Check that loteId was passed
    if(loteId === undefined) {

      console.error('loteId is not defined');

      return response.status(400).json({
        error: 'loteId/undefined',
      }).send('loteId is undefined');

    } else {

      const Firebase = admin.database();

      // Ref to Firebase path for the specified lote
      const FirebaseRef = Firebase.ref(`lotes/${loteId}`);

      // TODO: Check for user available tokens

      // Verify tokeId for security
      admin.auth().verifyIdToken(tokenId)

        .then(decodedToken => {

          // If the user id was verified
          if (decodedToken.uid) {

            // Save the uid for later use
            uid = decodedToken.uid;

            // Request the lote once
            return FirebaseRef.once('value');

          } else {

            // uid doesn't exist / couldn't be verified
            return response.status(401).json({
              error: 'unauthorized',
            }).send('No puedes realizar esta acción');
          }
        })

        .then( snapshot => {
          // Get queried lote
          const lote = snapshot.val();

          //Check if lote doesn't have an owner
          if(lote.owner === undefined) {

            // Create owner object
            let owner = {};
            owner[uid] = true; // Use uid as key
            owner['date'] = admin.database.ServerValue.TIMESTAMP; // Server timestamp

            // Update lote with owner object
            return FirebaseRef.update({owner});

          } else { // Lote already has an owner
            return response.status(409).json({
              error: 'lote/has-owner',
            }).send('Este lote ya fue adquirido');
          }
        })

        .then( () => {
          // Respond with success
          return response.send('Successfully acquired lote');
        })

        .catch(error => {
          return response.status(403).send('some error');
        });

    }
  });
});
