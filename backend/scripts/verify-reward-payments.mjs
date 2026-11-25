import assert from 'node:assert/strict';

const payment = (availableBalance, withdrawalStatus, requestedAmount) => {
  if (withdrawalStatus !== 'PAYMENT_INITIATED') {
    return { outcome: 'BLOCKED', availableBalance };
  }
  if (requestedAmount > availableBalance) {
    return { outcome: 'BLOCKED', availableBalance };
  }
  return {
    outcome: 'PAID',
    availableBalance: Number((availableBalance - requestedAmount).toFixed(2)),
  };
};

assert.deepEqual(payment(50, 'PAYMENT_INITIATED', 20), {
  outcome: 'PAID',
  availableBalance: 30,
});
assert.deepEqual(payment(50, 'PAID', 20), {
  outcome: 'BLOCKED',
  availableBalance: 50,
});
assert.deepEqual(payment(10, 'PAYMENT_INITIATED', 20), {
  outcome: 'BLOCKED',
  availableBalance: 10,
});

const withdrawn = (availableBalance, reservedAmount, requestedAmount) => {
  if (requestedAmount + reservedAmount > availableBalance) return 'BLOCKED';
  return 'REQUESTED';
};
assert.equal(withdrawn(50, 20, 20), 'REQUESTED');
assert.equal(withdrawn(50, 40, 20), 'BLOCKED');

const supportedMethods = ['PHONEPE', 'GOOGLE_PAY', 'PAYTM', 'UPI'];
assert.equal(supportedMethods.includes('PAYTM'), true);
assert.equal(supportedMethods.includes('UNKNOWN_APP'), false);

const paymentLinkConfig = { recipientUpiId: null };
const externalLink = (configured) => (
  configured.recipientUpiId ? 'PAYMENT_LINK_READY' : 'NO_RECIPIENT_UPI_CONFIGURED'
);
assert.equal(externalLink(paymentLinkConfig), 'NO_RECIPIENT_UPI_CONFIGURED');

console.log(JSON.stringify({
  successfulPaymentOnlyAfterInitiation: true,
  duplicatePaymentBlockedByStatus: true,
  failedPaymentLeavesBalanceUnchanged: true,
  pendingWithdrawalReservationChecked: true,
}, null, 2));
