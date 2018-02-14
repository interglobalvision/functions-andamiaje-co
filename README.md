# Installation

```
git clone git@github.com:interglobalvision/functions-andamiaje-co.git
cd functions-andamiaje-co/functions
yarn install
```

## Deploy all functions

  `firebase deploy --only functions`

## Deploy a specific function

  `firebase deploy --only functions:functionName`

## Serve functions locally

  `firebase serve --only functions`

(You might will need to configure your client to make requests to the given URL)

## Test with a file

Ex. testing `generateThumbnail()`

  `firebase experimental:functions:shell < test/generateThumbnail.js`


## Changing enviroment

```
firebase use default # sets environment to the default alias (which is out staging area)
firebase use production # sets environment to the production alias
```

For a single command, you can also specify the environment using the -P flag:
`firebase deploy -P production # deploy to production alias`
