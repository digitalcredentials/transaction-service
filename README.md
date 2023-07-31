# Transaction Manager Service _(@digitalcredentials/transaction-manager-service)_

> Express app for managing the transactions used in VC-API exchanges

## Table of Contents

- [Background](#background)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Background

Express app that:

- stores data associated with a VC-API exchange and generates associated exchangeID and transactionID
- generates and verifies UUID challenges used in DIDAuth
- generates both DCC deeplink and chapi wallet queries

Use as you like, but intended to be used to with the [DCC Exchange Coordinator](https://github.com/digitalcredentials/exchange-coordinator) to manage the challenges in the Wallet/Issuer DIDAuth exchange.

## Development

To install locally (for development):

```
git clone https://github.com/digitalcredentials/transaction-manager-service.git
cd transaction-manager-service
npm install
npm dev
```

## Usage

TBD

## Contribute

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[MIT License](LICENSE.md) © 2022 Digital Credentials Consortium.
