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
    let user;
    let lote;
    let owner;

    // Check that loteId was passed
    if (loteId === undefined) {

      // Respond: loteId us undefined
      throw new Error('loteId/undefined');

    } else {

      //admin.database.enableLogging(true);

      // Firebase
      const Firebase = admin.database();

      // Ref to Firebase path for the specified lote
      const Lote = Firebase.ref(`lotes/${loteId}`);

      // Ref to Firebase path for users
      const Users = Firebase.ref('users');

      // Verify tokeId for security
      return admin.auth().verifyIdToken(tokenId)

        .then(decodedToken => {
          console.log('Token Verified');

          if (decodedToken.uid) { // If the user id was verified

            // Save the uid for later use
            uid = decodedToken.uid;

            // Retrive User info
            return Users.child(uid).once('value');

          } else {

            // Respond: uid doesn't exist / couldn't be verified
            throw new Error('unauthorized');

          }
        })

        .then( snapshot => {
          console.log('User retrived');

          // Save User info
          user = snapshot.val();

          if (user.role !== 'member') { // Check if user is Member

            // Respond: User not a member
            throw new Error('unauthorized');
          }

          // Request the Lote info
          return Lote.once('value');

        })

        .then( snapshot => {
          console.log('Lote retrived');

          // Get queried lote
          lote = snapshot.val();

          if (lote.owner !== undefined) { //Check if lote has an owner
            console.log('Lote has owner');

            // Respond: Lote as an owner
            throw new Error('lote/has-owner');

          } else if (lote.price > user.tokens) {  // Check if user has enough tokens
            console.log('Too Expensive');

            // Repond: Too expensive
            throw new Error('lote/too-expensive');

          } else { // Is good to go
            console.log('OK, we good');

            // Owner Name
            const name = user.displayName !== '' ? user.displayName : user.name;

            // Acquisition Date
            const date = admin.database.ServerValue.TIMESTAMP; // Server timestamp

            // Set owner var
            owner =  {
              uid,
              name,
              date,
            };

            // Update lote with owner object using a transcation
            // More on transcactions here:
            // https://firebase.google.com/docs/reference/node/firebase.database.Reference#transaction
            return Firebase.ref(`lotes/${loteId}/owner`).transaction( intendedOwner => {
              // If lote doesn't have an owner
              if(intendedOwner === null) {
                return owner; // Add owner
              }

              // else: return nothing which aka abort the transacation
            },
            (error, committed, snapshot) => { // Callback
              if (error) {
                console.log('Transaction failed abnormally!', error);
                throw new Error(error);
              } else if (!committed) {
                console.log('We aborted the transaction (because owner already exists).');
                throw new Error('lote/has-owner');
              } else {
                console.log('Owner added!');
              }
              console.log('Owners data', snapshot.val());

            },
            true);
          }
        })

        .then( () => {
          console.log('Lote acquired');

          // Respond with success and return owner data
          return response.status(200).json({
            owner,
          });

        })

        .then( () => {
          console.log('Updating tokens');

          // Remaining tokens
          const tokens = user.tokens - lote.price;

          // Update user's remaining tokens
          return Users.child(uid).update({tokens});
        })

        .then( () => {
          console.log('Adding Lote to User Collection');

          // Add Lote to User's collection
          return Users.child(`${uid}/collection/${loteId}`).set(true);
        })

        .catch(error => {

          let status = 400;

          if(error.message) {

            switch (error.message) {
              case 'loteId/undefined':
                status = 400;
                break;
              case 'lote/has-owner':
                status = 409;
                break;
              case 'lote/too-expensive':
                status = 409;
                break;
              case 'unauthorized':
                status = 401;
                break;
              default:
                status = 403;
                break;
            }

            return response
              .status(status)
              .json({
                error: error.message,
              });
          }

          console.log('ERROR', error.message);

          return response.status(status);

        });

    }
  });
});
