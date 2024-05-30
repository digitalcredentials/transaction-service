# Transaction Manager Service _(@digitalcredentials/transaction-manager-service)_

[![Build status](https://img.shields.io/github/actions/workflow/status/digitalcredentials/transaction-service/main.yml?branch=main)](https://github.com/digitalcredentials/transaction-service/actions?query=workflow%3A%22Node.js+CI%22)
[![Coverage Status](https://coveralls.io/repos/github/digitalcredentials/transaction-service/badge.svg?branch=jc-add-healthz)](https://coveralls.io/github/digitalcredentials/transaction-service?branch=jc-add-healthz)

> Express app for managing the transactions used in [VC-API exchanges](https://w3c-ccg.github.io/vc-api/#initiate-exchange).

#### IMPORTANT NOTE ABOUT VERSIONING: If you are using a Docker Hub image of this repository, make sure you are reading the version of this README that corresponds to your Docker Hub version.  If, for example, you are using the image `digitalcredentials/transaction-service:0.1.0` then you'll want to use the corresponding tagged repo: [https://github.com/digitalcredentials/transaction-service/tree/v0.1.0](https://github.com/digitalcredentials/transaction-service/tree/v0.1.0). If you are new here, then just read on...

## Table of Contents

- [Overview](#overview)
- [API](#api)
- [Versioning](#versioning)
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

## Versioning

The transaction-service is primarily intended to run as a docker image within a docker compose network, typically as part of a flow that is orchestrated by the [DCC Issuer Coordinator](https://github.com/digitalcredentials/issuer-coordinator) and the [DCC Workflow Coordinator](https://github.com/digitalcredentials/workflow-coordinator). 

For convenience we've published the images for the transaction-service and the other services used by the coordinators, as well as for the coordinators themselves, to Docker Hub so that you don't have to build them locally yourself from the github repositories.

The images on Docker Hub will of course at times be updated to add new functionality and fix bugs. Rather than overwrite the default (`latest`) version on Docker Hub for each update, we've adopted the [Semantic Versioning Guidelines](https://semver.org) with our docker image tags.

We DO NOT provide a `latest` tag so you must provide a tag name (i.e, the version number) for the images in your docker compose file.

To ensure you've got compatible versions of the services and the coordinator, the `major` number for each should match. At the time of writing, the versions for each are at 0.1.0, and the `major` number (the leftmost number) agrees across all three.

If you do ever want to work from the source code in the repository and build your own images, we've tagged the commits in Github that were used to build the corresponding Docker image. So a github tag of v0.1.0 coresponds to a docker image tag of 0.1.0

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
