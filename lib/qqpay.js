
var util = require('./util');
var request = require('request');
var md5 = require('MD5');

exports = module.exports = QQPay;

function QQPay() {
	
	if (!(this instanceof QQPay)) {
		return new QQPay(arguments[0]);
	};

	this.options = arguments[0];
	this.qqPayID = { appid:this.options.appid, mch_id:this.options.mch_id };
};

QQPay.mix = function(){
	
	switch (arguments.length) {
		case 1:
			var obj = arguments[0];
			for (var key in obj) {
				if (QQPay.prototype.hasOwnProperty(key)) {
					throw new Error('Prototype method exist. method: '+ key);
				}
				QQPay.prototype[key] = obj[key];
			}
			break;
		case 2:
			var key = arguments[0].toString(), fn = arguments[1];
			if (QQPay.prototype.hasOwnProperty(key)) {
				throw new Error('Prototype method exist. method: '+ key);
			}
			QQPay.prototype[key] = fn;
			break;
	}
};


QQPay.mix('option', function(option){
	for( var k in option ) {
		this.options[k] = option[k];
	}
});


QQPay.mix('sign', function(param){

	var querystring = Object.keys(param).filter(function(key){
		return param[key] !== undefined && param[key] !== '' && ['pfx', 'partner_key', 'sign', 'key'].indexOf(key)<0;
	}).sort().map(function(key){
		return key + '=' + param[key];
	}).join("&") + "&key=" + this.options.partner_key;
	console.log('未加密的字符串：',querystring);
	return md5(querystring).toUpperCase();
});


QQPay.mix('createUnifiedOrder', function(opts, fn){

	opts.nonce_str = opts.nonce_str || util.generateNonceString();
	util.mix(opts, this.qqPayID);
	opts.sign = this.sign(opts);
    console.log('加密后的字符串：',opts.sign);

	request({
		url: "https://qpay.qq.com/cgi-bin/pay/qpay_unified_order.cgi",
		method: 'POST',
		body: util.buildXML(opts),
		agentOptions: {
			pfx: this.options.pfx,
			passphrase: this.options.mch_id
		}
	}, function(err, response, body){
		util.parseXML(body, fn);
	});
});

QQPay.mix('getBrandQQPayRequestParams', function(order, fn){

	order.trade_type = "JSAPI";
	var _this = this;
	this.createUnifiedOrder(order, function(err, data){
		var reqparam = {
			appId: _this.options.appid,
			timeStamp: Math.floor(Date.now()/1000)+"",
			nonceStr: data.nonce_str,
			package: "prepay_id="+data.prepay_id,
			signType: "MD5"
		};
		reqparam.paySign = _this.sign(reqparam);
		fn(err, reqparam);
	});
});

QQPay.mix('createMerchantPrepayUrl', function(param){

	param.time_stamp = param.time_stamp || Math.floor(Date.now()/1000);
	param.nonce_str = param.nonce_str || util.generateNonceString();
	util.mix(param, this.qqPayID);
	param.sign = this.sign(param);

	var query = Object.keys(param).filter(function(key){
		return ['sign', 'mch_id', 'product_id', 'appid', 'time_stamp', 'nonce_str'].indexOf(key)>=0;
	}).map(function(key){
		return key + "=" + encodeURIComponent(param[key]);
	}).join('&');

	return "qq://qqpay/bizpayurl?" + query;
});


QQPay.mix('useQQCallback', function(fn){

	return function(req, res, next){
		var _this = this;
		res.success = function(){ res.end(util.buildXML({ xml:{ return_code:'SUCCESS' } })); };
		res.fail = function(){ res.end(util.buildXML({ xml:{ return_code:'FAIL' } })); };

		util.pipe(req, function(err, data){
			var xml = data.toString('utf8');
			util.parseXML(xml, function(err, msg){
				req.qqmessage = msg;
				fn.apply(_this, [msg, req, res, next]);
			});
		});
	};
});
 

QQPay.mix('queryOrder', function(query, fn){
	
	if (!(query.transaction_id || query.out_trade_no)) { 
		fn(null, { return_code: 'FAIL', return_msg:'缺少参数' });
	}

	query.nonce_str = query.nonce_str || util.generateNonceString();
	util.mix(query, this.qqPayID);
	query.sign = this.sign(query);

	request({
		url: "https://qpay.qq.com/cgi-bin/pay/qpay_order_query.cgi",
		method: "POST",
		body: util.buildXML({xml: query})
	}, function(err, res, body){
		util.parseXML(body, fn);
	});
});


QQPay.mix('closeOrder', function(order, fn){

	if (!order.out_trade_no) {
		fn(null, { return_code:"FAIL", return_msg:"缺少参数" });
	}

	order.nonce_str = order.nonce_str || util.generateNonceString();
	util.mix(order, this.qqPayID);
	order.sign = this.sign(order);

	request({
		url: "https://qpay.qq.com/cgi-bin/pay/qpay_close_order.cgi",
		method: "POST",
		body: util.buildXML({xml:order})
	}, function(err, res, body){
		util.parseXML(body, fn);
	});
});


QQPay.mix('refund',function(order, fn){
	if (!(order.transaction_id || order.out_refund_no)) { 
		fn(null, { return_code: 'FAIL', return_msg:'缺少参数' });
	}

	order.nonce_str = order.nonce_str || util.generateNonceString();
	util.mix(order, this.qqPayID);
	order.sign = this.sign(order);

	request({
		url: "https://api.qpay.qq.com/cgi-bin/pay/qpay_refund.cgi",
		method: "POST",
		body: util.buildXML({xml: order}),
		agentOptions: {
			pfx: this.options.pfx,
			passphrase: this.options.mch_id
		}
	}, function(err, response, body){
		util.parseXML(body, fn);
	});
});

