export default function TransactionException(code, message, stack) {
    this.code = code
    this.message = message
    this.stack = stack
  }
  