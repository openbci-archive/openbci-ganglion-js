# openbci-ganglion-js

[![Build Status](https://travis-ci.org/openbci/openbci-ganglion-js.png?branch=master)](https://travis-ci.org/openbci/openbci-ganglion-js)

Ganglion biosensor JavaScript Library (using Web Bluetooth)

This app is 100% based of [muse-js](https://github.com/urish/muse-js) by Uri Shaked. This project is not endorsed by Uri in the slightest bit.

## Running the demo app

    yarn
    yarn start

and then open http://localhost:4445/

## Usage example

```javascript

import { GanglionClient } from 'openbci-ganglion-js';

async function main() {
  let client = new GanglionClient();
  await client.connect();
  await client.start();
  client.eegReadings.subscribe(reading => {
    console.log(reading);
  });
  client.accelerometerData.subscribe(acceleration => {
    console.log(acceleration);
  });
}

main();
```
