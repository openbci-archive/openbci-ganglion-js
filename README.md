# The OpenBCI Web Bluetooth Driver - !!WARNING!! STILL IN PRE-ALPHA PHASE

<p align="center">
  <img alt="banner" src="/images/ganglion_head_shot.jpg/" width="600">
</p>
<p align="center" href="">
  Provide a stable cross platform web bluetooth driver for the OpenBCI Ganglion
</p>


## Welcome!

First and foremost, Welcome! :tada: Willkommen! :confetti_ball: Bienvenue! :balloon::balloon::balloon:

Thank you for visiting the OpenBCI Ganglion Web Bluetooth repository.

This document (the README file) is a hub to give you some information about the project. Jump straight to one of the sections below, or just scroll down to find out more.

* [What are we doing? (And why?)](#what-are-we-doing)
* [Who are we?](#who-are-we)
* [What do we need?](#what-do-we-need)
* [How can you get involved?](#get-involved)
* [Get in touch](#contact-us)
* [Find out more](#find-out-more)
* [Installing](#installing)

## What are we doing?

### The problem

* OpenBCI Ganglion NodeJS must rely on [`noble`](https://github.com/sandeepmistry/noble) for bluetooth control.
* Some linux and macOS users drop a lot of packets using the current drivers
* There is no cross platform driver for Ganglion right now
* People must use NodeJS always
* Ganglion data is compressed and in a very raw form, takes programmers a while to understand

So, it's clear there are some issues that need to be fixed!

### The solution

The OpenBCI Ganglion Web Bluetooth driver will:

* Will leverage web bluetooth which is supported by a massive community
* Hopfully solve the dropped packet problem on mac and linux
* Avoid windows users from having to use a dongle
* Be fun and easy to use
* Take the hard work of decompressing the raw data stream for programmers

Using the OpenBCI Ganglion Web Bluetooth driver allows you, the user, to quickly

## Who are we?

Mainly, we are community of programmers who love brainwaves on the browser. The original code writer was [Uri Shaked][link_uri_shaked]'s and we hard forked his [muse-js](https://github.com/urish/muse-lsl) library. AJ Keller overhauled and applied his work from [OpenBCI_Ganglion_NodeJS](github.com/OpenBCI/OpenBCI_Ganglion_NodeJS).

## What do we need?

**You**! In whatever way you can help.

We need expertise in programming, user experience, software sustainability, documentation and technical writing and project management.

We'd love your feedback along the way.

Our primary goal is to brovide a stable cross platform web bluetooth driver for the OpenBCI Ganglion, and we're excited to support the professional development of any and all of our contributors. If you're looking to learn to code, try out working collaboratively, or translate you skills to the digital domain, we're here to help.

## Get involved

If you think you can help in any of the areas listed above (and we bet you can) or in any of the many areas that we haven't yet thought of (and here we're *sure* you can) then please check out our [contributors' guidelines](CONTRIBUTING.md) and our [roadmap](ROADMAP.md).

Please note that it's very important to us that we maintain a positive and supportive environment for everyone who wants to participate. When you join us we ask that you follow our [code of conduct](CODE_OF_CONDUCT.md) in all interactions both on and offline.


## Contact us

If you want to report a problem or suggest an enhancement we'd love for you to [open an issue](../../issues) at this github repository because then we can get right on it. But you can also contact [AJ][link_aj_keller] by email (pushtheworldllc AT gmail DOT com) or on [twitter](https://twitter.com/aj-ptw).

## Find out more

You might be interested in:

* Purchase a [Cyton][link_shop_cyton] | [Ganglion][link_shop_ganglion] | [WiFi Shield][link_shop_wifi_shield] from [OpenBCI][link_openbci]

And of course, you'll want to know our:

* [Contributors' guidelines](CONTRIBUTING.md)
* [Roadmap](ROADMAP.md)

## Thank you

Thank you so much (Danke schön! Merci beaucoup!) for visiting the project and we do hope that you'll join us on this amazing journey to provide a stable cross platform web bluetooth driver for the OpenBCI Ganglion.

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

## <a name="license"></a> License:

MIT

[link_aj_keller]: https://github.com/aj-ptw
[link_shop_wifi_shield]: https://shop.openbci.com/collections/frontpage/products/wifi-shield?variant=44534009550
[link_shop_ganglion]: https://shop.openbci.com/collections/frontpage/products/pre-order-ganglion-board
[link_shop_cyton]: https://shop.openbci.com/collections/frontpage/products/cyton-biosensing-board-8-channel
[link_shop_cyton_daisy]: https://shop.openbci.com/collections/frontpage/products/cyton-daisy-biosensing-boards-16-channel
[link_ptw]: https://www.pushtheworldllc.com
[link_openbci]: http://www.openbci.com
[link_gui_widget_tutorial]: http://docs.openbci.com/Tutorials/15-Custom_Widgets
[link_gui_run_from_processing]: http://docs.openbci.com/OpenBCI%20Software/01-OpenBCI_GUI#the-openbci-gui-running-the-openbci-gui-from-the-processing-ide
[link_uri_shaked]: https://github.com/urish