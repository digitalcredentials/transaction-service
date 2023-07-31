# Transaction Manager Service _(@digitalcredentials/transaction-manager-service)_

> Express app for managing the transactions used in VC-API exchanges

## Table of Contents

- [Overview](#overview)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Overview

This is an express app that:

- stores data associated with a VC-API exchange and generates an exchangeID and transactionID
- generates and verifies UUID challenges used in DIDAuth Verifiable Presentations
- verifies DIDAuth signature
- generates both DCC deeplink and chapi wallet queries

Use as you like, but this is primarily intended to be used to with the [DCC Exchange Coordinator](https://github.com/digitalcredentials/exchange-coordinator) to manage the challenges in the Wallet/Issuer DIDAuth exchange.

Especially meant to be used as a service within a Docker compose network, initialized by the coordinator from within the Docker compose network, and then called externally by a wallet like the Leaner Credential Wallet. To that end, a Docker image for this app is published to DockerHub to make it easier to wire this into a Docker compose network.

## API

Implements three endpoints:

* POST /exchange

Initializes the exchange. Expects an object containing the data that will later be used to issue the credential, like so:

 ```
 {
    vc: "an unsigned populated VC",
    subjectData:  "optional - data to populate a VC",
    exchangeHost: "hostname for the exchange endpoints",
    instance: "instance of digitalcredentials/issuer-core with which to sign",
    batchId: "batch to which cred belongs; determines vc template to use"
 }
 ```

 The endpoint stores the data in a key/value store along with newly generated UUIDs for the exchangeId, transactionId and a challenge to be used later for a DIDAuth request.

 The endpoint returns an object with two options for opening a wallet: a custom deeplink that will open the Learner Credential Wallet and a CHAPI request that can be used to open a CHAPI enabled wallet.

* POST /exchange/{exchangeId}

Called by the holder (or more specifically the 'holder coordinator' which is likely a wallet) to initiate the exchange. Returns a Verifiable Presentation Request asking the wallet for a DIDAuth

* POST /exchange/{exchangeId}/{transactionId}

Completes the exchange. Receives the requested DIDAuth and returns the signed Verifiable Credential after verifying the DIDAuth.


## Development

To install locally (for development):

```
git clone https://github.com/digitalcredentials/transaction-manager-service.git
cd transaction-manager-service
npm install
npm dev
```

## Contribute

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[MIT License](LICENSE.md) © 2022 Digital Credentials Consortium.
