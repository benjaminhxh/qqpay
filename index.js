
var QQPay = require('./lib/qqpay');

QQPay.mix('Util', require('./lib/util'));

module.exports = QQPay;