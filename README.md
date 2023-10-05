# Transaction Manager Service _(@digitalcredentials/transaction-manager-service)_

[![Build status](https://img.shields.io/github/actions/workflow/status/digitalcredentials/transaction-service/main.yml?branch=main)](https://github.com/digitalcredentials/transaction-service/actions?query=workflow%3A%22Node.js+CI%22)

> Express app for managing the transactions used in [VC-API exchanges](https://w3c-ccg.github.io/vc-api/#initiate-exchange).

## Table of Contents

- [Overview](#overview)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Overview

This is an express app that:

- stores data associated with a [VC-API exchange](https://w3c-ccg.github.io/vc-api/#initiate-exchange) and generates an exchangeID and transactionID
- generates and verifies UUID challenges used in [DIDAuthentication Verifiable Presentation Requests](https://w3c-ccg.github.io/vp-request-spec/#did-authentication)
- verifies [DID Authentication](https://w3c-ccg.github.io/vp-request-spec/#did-authentication) signatures
- generates both DCC deeplink and [CHAPI}(https://chapi.io) wallet queries

Use as you like, but this is primarily intended to be used to with the [DCC Exchange Coordinator](https://github.com/digitalcredentials/exchange-coordinator) to manage the challenges in the Wallet/Issuer DIDAuth exchange.

Especially meant to be used as a service within a Docker compose network, initialized by the coordinator from within the Docker compose network, and then called externally by a wallet like the [Leaner Credential Wallet](https://lcw.app). To that end, a Docker image for this app is published to DockerHub to make it easier to wire this into a Docker compose network.

## API

Implements three endpoints:

* POST /exchange

Initializes the exchange for an array of [Verifiable Credentials](https://www.w3.org/TR/vc-data-model/). Expects an object containing the data that will later be used to issue the credentials, like so:

 ```
 {
    exchangeHost: "hostname to use when constructing the exchange endpoints",
    tenantName: "the tenant with which to later sign the credentials",
    data: [
       {
          vc: "an unsigned populated Verifiable Credential",
          retrievalId: "an ID to later use to select the generated VPR/deeplink for this credential"
       },
       {
          vc: "another unsigned populated Verifiable Credential",
          retrievalId: "another ID to later use to select the generated VPR/deeplink for this credential"
       },
        ... however many other credentials to setup an exchange for
    ]
 }
 ```

 The endpoint stores the data in a key/value store along with newly generated UUIDs for the exchangeId, transactionId and a challenge to be used later for a [DIDAuthentication Verifiable Presentation Request](https://w3c-ccg.github.io/vp-request-spec/#did-authentication).

 The endpoint returns an object with two options for opening a wallet: a custom deeplink that will open the Learner Credential Wallet and a [CHAPI}(https://chapi.io) request that can be used to open a [CHAPI}(https://chapi.io) enabled wallet. In both cases the deeplink or chapi request will prompt the wallet to submit a DID Authenticaion to the exchange endpoint, which will return the signed credential.

 The object will look something like so:

 ```json
[
    {
        "retrievalId": "someId",
        "directDeepLink": "https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&challenge=27485032-e0bc-4d74-bb5a-bb778cd7f8e3&vc_request_url=http://localhost:4005/exchange/993cce5e-58a8-41ce-a055-bef4a8253379/27485032-e0bc-4d74-bb5a-bb778cd7f8e3",
        "vprDeepLink": "https://lcw.app/request.html?issuer=issuer.example.com&auth_type=bearer&vc_request_url=http://localhost:4005/exchange/993cce5e-58a8-41ce-a055-bef4a8253379",
        "chapiVPR": {
            "query": {
                "type": "DIDAuthentication"
            },
            "interact": {
                "service": [
                    {
                        "type": "VerifiableCredentialApiExchangeService",
                        "serviceEndpoint": "http://localhost:4005/exchange/993cce5e-58a8-41ce-a055-bef4a8253379/27485032-e0bc-4d74-bb5a-bb778cd7f8e3"
                    },
                    {
                        "type": "CredentialHandlerService"
                    }
                ]
            },
            "challenge": "27485032-e0bc-4d74-bb5a-bb778cd7f8e3",
            "domain": "http://localhost:4005"
        }
    }
]
 ```

* POST /exchange/{exchangeId}

Called by the wallet to initiate the exchange. Returns a [DIDAuthentication Verifiable Presentation Request](https://w3c-ccg.github.io/vp-request-spec/#did-authentication) asking the wallet for a DID Authentication

* POST /exchange/{exchangeId}/{transactionId}

Called by the wallet to complete the exchange. Receives the requested DID Authentication and returns the signed Verifiable Credential after verifying the DID Authentication.

NOTE: the object returned from the initial setup call to the exchanger returns two deepLinks:

- `directDeepLink` which prompts the wallet to bypass the `POST /exchange/{exchangeId}` initiation call, and instead simply instead immediately submit the DID Authentication. The signed credential is returned from this call. So this is a one-step process.
- `vprDeepLink` which prompts the wallet to first call the inititaion endpoint, from which the [DIDAuthentication Verifiable Presentation Request](https://w3c-ccg.github.io/vp-request-spec/#did-authentication) is returned, and after which the wallet then submits its DID Authentication.  So this is a two-step process.

At the moment, the [Leaner Credential Wallet](https://lcw.app) only supports the directDeepLink.

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
