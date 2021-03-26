ko.bindingHandlers['reset'] = {
  init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    if (typeof valueAccessor() !== 'function')
      throw new Error('The value for a reset binding must be a function');

    ko.utils.registerEventHandler(element, 'reset', function(event) {
      var handlerReturnValue;
      var value = valueAccessor();

      try {
        handlerReturnValue = value.call(bindingContext['$data'], element);
      } finally {
        if (handlerReturnValue !== true) {
          if (event.preventDefault)
            event.preventDefault();
          else
            event.returnValue = false;
        }
      }
    });
  }
};

ko.bindingHandlers.datepicker = {
  init: function(element, valueAccessor, allBindingsAccessor) {
    //initialize datepicker with some optional options
    var options = allBindingsAccessor().datepickerOptions || {};
    $(element).datepicker(options);

    //when a user changes the date, update the view model
    ko.utils.registerEventHandler(element, "changeDate", function(event) {
      var value = valueAccessor();
      if (ko.isObservable(value)) {
        value(event.date);
      }
    });
  },
  update: function(element, valueAccessor)   {
    var widget = $(element).data("datepicker");
    //when the view model is updated, update the widget
    if (widget) {
      widget.date = ko.utils.unwrapObservable(valueAccessor());
      if (widget.date) {
        widget.setValue();
      }
    }
  }
};

function UserData() {
  var self = this;
  self.text = ko.observable('');
}

function Payment(txHash, date, amount, confirmed, extra) {
  var self = this;
  self.txHash = ko.observable(txHash);
  self.amount = ko.observable(amount);
  self.confirmed = ko.observable(confirmed);
  self.extra = ko.observable(extra);
  self.date = ko.observable(date);
}

function Payments(originAddress) {
  var self = this;

  self.originAddress = originAddress;
  self.maxSize = ko.observable(10);
  self.numPerPage = ko.observable(50);
  self.currentPage = ko.observable(1);

  self.totalPayments = ko.observable('--');

  self.total_paid = ko.observable('--');
  self.payments = ko.observableArray([]);

  self.payments_modal_visible = ko.observable(false);
  self.downloadDateFrom = ko.observable(null);
  self.downloadDateTo = ko.observable(null);
  self.show_error = ko.observable(false);
  self.error = ko.observable("");
}

Payments.prototype.showDownloadPayments = function() {
  var self = this;
  if (self.total_paid() > 0) {
    $(function () {
      $('#datepicker').datepicker({
        todayHighlight: true,
        endDate: '0d'
      });

    });
    self.payments_modal_visible(true);
  }
};

Payments.prototype.downloadPayments = function() {
  var self = this;
  if(self.downloadDateFrom() != null && self.downloadDateTo() != null){
    request('/payments_interval/' +
        self.originAddress + '/' +
        self.downloadDateFrom().getTime() / 1000 + '/' +
        self.downloadDateTo().getTime() / 1000, 60,
        function(data) {
          if(data.length > 0) {
            self.show_error(false);
            var total = 0;
            data.forEach(function (payment) {
              total += payment.amount;
            });
            var csv = "data:text/csv;charset=utf-8,";
            csv += 'Payments history for,' + self.originAddress + '\r\n';
            csv += 'From,' + self.downloadDateFrom().toString() + '\r\n';
            csv += 'To,' + self.downloadDateTo().toString() + '\r\n';
            csv += 'Total,' + total + '\r\n';
            csv += '№,date,txid,amount,status\r\n';
            data.forEach(function (payment, idx) {
              csv += [idx, payment.date, payment.txHash, payment.amount, payment.confirmed].join(",") + '\r\n';
            });
            var encodedUri = encodeURI(csv);
            var link = document.createElement("a");
            link.style.display = "none";
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", self.originAddress + ".csv");
            document.body.appendChild(link); // Required for FF

            link.click();

          } else {
            self.error('No payments found in the selected interval');
            self.show_error(true);
          }
          console.log(data);
        }, function (error) {
          self.error('Something went wrong. Try to choose another dates.');
          self.show_error(true);
        });
  }
};

function UserSettings(address, parent) {
  var self = this;
  self.parent = parent;
  self.successMessage = ko.observable('');
  self.errorMessage = ko.observable('');
  self.min_payout = ko.observable();
  self.current_min_payout = ko.observable();
  self.current_pubkey = ko.observable();
  self.balance = ko.observable();
  self.pubkey = ko.observable();
  self.password = ko.observable('');
  self.address = ko.observable(address);
  self.processing = ko.observable(false);
  self.forcePayout = function() {
    var url = apiUrl + '/force_payout/' + self.address();
    if (self.password().length === 0) {
      self.errorMessage(gettext('Password can not be empty'));
      return;
    }
    if (self.password().length < 6) {
      self.errorMessage(gettext('Password too short'));
      self.processing(false);
      return;
    }
    // if(self.balance() < config.txFee){
    //     self.errorMessage('Too small balance. You must have at least ' + config.txFee + ' ' + config.shortNameUpper + ' to request payout');
    //     self.processing(false);
    //     return;
    // }
    var data = {};
    data.password = self.password();
    $.ajax({
      type: "POST",
      url: url,
      data: data,
      crossDomain: true,
      dataType: 'json'
    })
      .done(function(data) {
        self.processing(false);
        if (data.status === false) {
          self.errorMessage(data.error);
        } else {
          self.successMessage(gettext('Payout request accepted'))
        }
      })
      .fail(function(xhr, textStatus, errorThrown) {
        self.processing(false);
        self.errorMessage(gettext('Internal server error'));
      });
  };
  self.resetUserSettings = function() {
    self.min_payout('');
    self.pubkey('');
    self.password('');
    return false;
  };

  self.changeUserSettings = function() {
    self.processing(true);
    self.errorMessage('');
    self.successMessage('');
    var url = apiUrl + '/change_settings/' + self.address();
    var data = {};
    if (self.password().length === 0) {
      self.errorMessage(gettext('Password can not be empty'));
      self.processing(false);
      return;
    }
    if (self.password().length < 6) {
      self.errorMessage(gettext('Password too short'));
      self.processing(false);
      return;
    }
    if (self.min_payout() !== 0 && self.min_payout() !== undefined) {
      if (self.min_payout() < config.minPayoutFrom || self.min_payout() > 0.01) {
        self.errorMessage(format(gettext('Minimum payout must be less then ' + config.minPayoutFrom + ' and greater then ' + 0.01), {
          min: 0.01,
          max: config.minPayoutFrom
        }));
        self.processing(false);
        return;
      }
      data.min_payout = self.min_payout();
    }
    if (self.pubkey() !== undefined && self.pubkey() !== null && self.pubkey().length > 0) {
      if (self.pubkey().length !== 102 && self.pubkey().length !== 140 && self.pubkey().length !== 192) {
        self.errorMessage(gettext('Public key must contain 102, 140 or 192 characters(only letters and digits are allowed)'));
        self.processing(false);
        return;
      }
      data.pubkey = self.pubkey();
    }
    data.password = self.password();
    if (Object.keys(data).length <= 1) {
      self.errorMessage(gettext('Change some settings'));
      self.processing(false);
      return;
    }
    $.ajax({
      type: "POST",
      url: url,
      data: data,
      crossDomain: true,
      dataType: 'json'
    })
      .done(function(data) {
        self.processing(false);
        if (data.status === false) {
          self.errorMessage(data.error);
        } else {
          self.successMessage(gettext('Settings successfully changed'));
          if (data.data.min_payout !== undefined) {
            self.current_min_payout(self.min_payout());
            self.parent.min_payout(self.min_payout());
          }
          if (data.data.pubkey !== undefined) {
            self.current_pubkey(self.pubkey());
          }
        }
      })
      .fail(function(xhr, textStatus, errorThrown) {
        self.processing(false);
        self.errorMessage(gettext('Internal server error'));
      });
  };
}

function getUserSettings(originAddress, callback) {
  request('/usersettings/' + originAddress, 30, function(data) {
    if (data === null) {
      callback(config.minPayout);
    } else {
      callback(data.payout, data.pubkey);
    }
  });
}

function CalcValues(currency) {
  var self = this;
  self.currency = ko.observable(currency);
  self.coins = ko.observable('--');
  self.bitcoins = ko.observable('--');
  self.dollars = ko.observable('--');
  self.euros = ko.observable('--');
  self.yuan = ko.observable('--');
  self.rubles = ko.observable('--');
  self.pounds = ko.observable('--');
  self.current = ko.computed(function() {
    return self[self.currency()] && typeof self[self.currency()] === 'function' ? self[self.currency()]() : '0.0';
  });
}

CalcValues.prototype.setCurrency = function(currency) {
  self.currency(currency);
}

CalcValues.prototype.setValues = function(data) {
  var self = this;
  self.coins(new BigNumber(data.coins).toFormat(config.coinCalcSigns));
  self.bitcoins(new BigNumber(data.bitcoins).toFormat(config.btcCalcSigns));
  self.coins(new BigNumber(data.coins).toFormat(config.coinCalcSigns));
  self.bitcoins(new BigNumber(data.bitcoins).toFormat(config.btcCalcSigns));
  self.dollars(new BigNumber(data.dollars).toFormat(config.usdCalcSigns));
  self.yuan(new BigNumber(data.yuan).toFormat(config.usdCalcSigns));
  self.euros(new BigNumber(data.euros).toFormat(config.usdCalcSigns));
  self.rubles(new BigNumber(data.rubles).toFormat(config.usdCalcSigns));
  self.pounds(new BigNumber(data.pounds).toFormat(config.usdCalcSigns))
};

function Calc(currency) {
  var self = this;
  self.data = null;
  self.current_currency = ko.observable(currency);
  self.full_currency_name = ko.computed(function() {
    switch (self.current_currency()) {
      case "RUR":
        return "rubles";
      case "CNY":
        return "yuan";
      case "EUR":
        return "euros";
      case "USD":
        return "dollars";
      case "GBP":
        return "pounds";
      default:
        null;
    }
  });
  self.minute = ko.observable(new CalcValues(self.full_currency_name()));
  self.hour = ko.observable(new CalcValues(self.full_currency_name()));
  self.day = ko.observable(new CalcValues(self.full_currency_name()));
  self.week = ko.observable(new CalcValues(self.full_currency_name()));
  self.month = ko.observable(new CalcValues(self.full_currency_name()));
  self.changeValues = ko.computed(function() {
    self.minute().currency(self.full_currency_name());
    self.hour().currency(self.full_currency_name());
    self.day().currency(self.full_currency_name());
    self.week().currency(self.full_currency_name());
    self.month().currency(self.full_currency_name());
  });
}

Calc.prototype.setValues = function(data) {
  var self = this;
  self.data = data;
  self.minute().setValues(data.minute);
  self.hour().setValues(data.hour);
  self.day().setValues(data.day);
  self.week().setValues(data.week);
  self.month().setValues(data.month);
};

PageViewModel.prototype.checkWorkerName = function(worker) {
  var self = this;
  var valid = /^[0-9a-zA-Z_\-]+$/.test(worker);
  if (!valid) {
    self.badWorkerName(gettext("Worker name must contain only numbers, letters, underscores, and dashes."));
  }
};


PageViewModel.prototype.parseAddress = function() {
  var self = this;
  self.badWorkerName = ko.observable('');
  self.workerPage = ko.observable(false);
  var pathArray = window.location.pathname.split('/');
  self._address = pathArray[2];
  self._originAddress = self._address;
  if (config.shortNameUpper === 'ETH' || config.shortNameUpper === 'ETC' || config.shortNameUpper === 'SIA')
    self._originAddress = self._originAddress.toLowerCase();
  self._workerUrl = "";
  if (pathArray.length > 3 && pathArray[3].length > 0) {
    var worker = pathArray[3];
    self._workerUrl = "/" + worker;
    self.workerPage(true);
    self.checkWorkerName(worker);
  }
  if (config.shortNameUpper === 'GRIN'){
    request('/address_by_uid/' + self._address, 60,
        function(data) {
          self.paymentAddress(data);
        });
  }
};

PageViewModel.prototype.init = function(currency) {
  var self = this;

  self.prices = ko.observable({});
  self.paymentAddress = ko.observable('');
  self.show_offline_workers = ko.observable(true);
  self.worker = ko.observable("");
  self.hashrate = ko.observable('--');
  self.balance = ko.observable('--');
  self.balance_tooltip = ko.observable('--');
  self.balance_float = ko.observable();
  self.balance_unconfirmed = ko.observable('--');
  self.balance_progress = ko.observable(0);
  self.balance_progress_visible = ko.observable(false);
  self.balance_progress_type = ko.observable('info');
  self.balance_progress_striped = ko.observable(true);
  self.balance_progress_tooltip = ko.observable('');
  self.avghashrate = ko.observable({
    h1: '',
    h3: '',
    h6: '',
    h12: '',
    h24: ''
  });
  self.avghashratetooltip = ko.observable("");
  self.last_reported_hashrate = ko.observable('--');
  if (!self.workerPage()) {
    self.workers = ko.observable(new Workers());
    self.workers().workers.extend({
      rateLimit: 250
    });
  }
  self.totalWorkers = ko.observable(1001);

  self.hour_coins = ko.observable('--');
  self.hour_bitcoins = ko.observable('--');
  self.hour_dollars = ko.observable('--');
  self.hour_yuan = ko.observable('--');
  self.hour_euros = ko.observable('--');
  self.hour_rubles = ko.observable('--');
  self.hour_pounds = ko.observable('--');

  self.sharerates = ko.observableArray([]);
  self.min_payout = ko.observable('--');

  self.message_db = ko.observable('');
  self.zec_alert = ko.observable('');

  self.currency = ko.observable(currency);

  self.calc = ko.observable(new Calc(self.currency()));

  self.calc_currency = ko.computed(function() {
    self.calc().current_currency(self.currency());
    return true;
  });
  self.badPrefix = ko.observable('');
  self.badPID = ko.observable('');
  if (config.shortName === 'pasc') {
    self.pasc_public_alert = ko.observable();
  }


  self.payments = ko.observable(new Payments(self._originAddress));

  self.altpayments = ko.observable(new Payments(self._originAddress));


  self._exchangeWallet = false;

  self.loading_json_data_modal = ko.observable(true);
  self.jsondatahtml = ko.observable(new UserData());
  self.json_data_modal_Visible = ko.observable(false);

  self.settings_loading_modal = ko.observable(true);
  self.settings_modal_visible = ko.observable(false);
  self.workers_avg_loading = ko.observable(true);

  self.unconfirmedTooltip = ko.observable("<div style='text-align: center'>" + "Confirmation " + config.blockConfirmation + " blocks (~ " + config.blockConfirmationTime + ")" + "</div>");
  self.balance_alert_text = ko.computed(function() {
    if (self.min_payout() === undefined || self.min_payout() === null || self.min_payout() === 0 || self.balance_float() === undefined || self.min_payout() < self.balance_float())
      return '';
    else
      return gettext("Minimum payout is ") + self.min_payout() + ' ' + config.shortNameUpper;
  }, this);
  self.balance_tooltip_compute = ko.computed(function() {
    if (self.currency() && self.prices()['price_' + self.calc().current_currency().toLowerCase()] && self.balance_float()) {
      var currency_value = new BigNumber(Math.max(0, self.prices()['price_' + self.calc().current_currency().toLowerCase()] * self.balance_float())).toFormat(2);
      self.balance_tooltip(currency_value + ' ' + self.currency());
    } else {
      self.balance_tooltip('--');
    }
  });
};

PageViewModel.prototype.checkAddress = function(addr) {
  var self = this;
  if (config.shortName === 'pasc') {
    var valid = /^\d+$/.test(addr) || /^\d+-\d{2}$/.test(addr);
    if (!valid) {
      self.badPrefix(gettext("Your address is invalid. Address must contain only digits"));
    } else {
      if (addr.indexOf("86646") === 0){
        self.badPrefix(gettext("Poloniex delisted PascalCoin. Payments to Poloniex are stopped. Please, contact support."));
      }
    }
  }
  if (config.shortName === 'etn') {
    if (addr.indexOf('etn') !== 0 && addr.indexOf('f4') !== 0)
      self.badPrefix(gettext("Address must start from 'etn' or 'f4' symbols."));
  }
  if (config.shortName === 'zec') {
    if (addr.indexOf('t') !== 0)
      self.badPrefix(gettext("Address must start from 't' symbol."));
    request('/address/validate/' + self._originAddress, 30, function(data) {
      if (!data)
        self.badPrefix(gettext("Your address is invalid. Please, contact support."));
    });
  }
  if (config.shortName === 'xmr') {
    request('/address/validate/' + self._originAddress.split('.')[0], 30, function(data) {
      if (!data) self.badPrefix(gettext("Your address is invalid. Please, contact support."));
    });
  }
};

PageViewModel.prototype.checkPID = function(addr, pid) {
  var self = this;
  if (config.shortName === 'pasc' && addr === '86646') {
    var valid = /^[0-9a-f]{16}$/.test(pid);
    if (!valid) {
      self.badPID(gettext("Payment-ID length must be 16 characters. Your payment-ID contains " + pid.length + ' characters.'));
    }
  }
};

PageViewModel.prototype.replaceAddressByExchange = function() {
  var self = this;
  if (config.hasPaymentID !== undefined && config.hasPaymentID) {
    var addressParts = self._address.split('.');
    self._address = addressParts[0];
    self.checkAddress(self._address);
    self._paymentID = undefined;
    if (addressParts.length > 1) {
      self._paymentID = addressParts[1];
      self.checkPID(self._address, self._paymentID);
    }
    if (exchanges.hasOwnProperty(config.shortName)) {
      var ex = exchanges[config.shortName];
      ex.forEach(function(exchange) {
        if (exchange.address === self._address) {
          self._address = exchange.name;
          self._exchangeWallet = true;
        }
      });
    }
  } else {
    self.checkAddress(self._address);
  }
};

PageViewModel.prototype.checkWrongLengthAddress = function() {
  var self = this;
  self.addressLengths = ko.observableArray(config.addressLength);
  var wrongLength = true;
  if (self.addressLengths() !== undefined && !self._exchangeWallet && self.addressLengths().length > 0) {
    for (var i = 0; i < self.addressLengths().length; i++)
      if (self._address.length === self.addressLengths()[i]) {
        wrongLength = false;
        break;
    }
  } else {
    wrongLength = false;
  }
  self.wrongLength = ko.observable(wrongLength);
  if (self.wrongLength()) {
    var rightLengths = self.addressLengths()[0];
    for (var i = 1; i < self.addressLengths().length; i++)
      rightLengths = format(gettext(rightLengths + " or " + self.addressLengths()[i]), {
        rightLengths: rightLengths,
        newLength: self.addressLengths()[i]
      });
    self.wrongLengthText = ko.observable(format(gettext("Address length must be " + rightLengths + " characters. Your address contains " + self.address().length + " characters. Please, contact support at " + config.mail), {
      rightLength: rightLengths,
      length: self.address().length,
      mail: config.mail
    }));
  } else {
    self.wrongLengthText = ko.observable("");
  }
  var self = this;
  self.addressLengths = ko.observableArray(config.addressLength);
  var wrongLength = true;
  if (self.addressLengths() !== undefined && !self._exchangeWallet && self.addressLengths().length > 0) {
    for (var i = 0; i < self.addressLengths().length; i++)
      if (self._address.length === self.addressLengths()[i]) {
        wrongLength = false;
        break;
    }
  } else {
    wrongLength = false;
  }
  self.wrongLength = ko.observable(wrongLength);
  if (self.wrongLength()) {
    var rightLengths = self.addressLengths()[0];
    for (var i = 1; i < self.addressLengths().length; i++)
      rightLengths = format(gettext(rightLengths + " or " + self.addressLengths()[i]), {
        rightLengths: rightLengths,
        newLength: self.addressLengths()[i]
      });
	  self.wrongLengthText = ko.observable(format(gettext("Address length must be " + rightLengths + " characters. Your address contains " + self.address().length + " characters. Please, contact support at " + config.mail), {
      rightLength: rightLengths,
      length: self.address().length,
      mail: config.mail
    }));
  } else {
    self.wrongLengthText = ko.observable("");
  }

  if (config.shortName === 'xmr' && self._paymentID !== undefined) {
    self.wrongLengthPaymentID = ko.observable("Monero payment ID is deprecated. Please, contact your exchange.");
  } else {
    self.wrongLengthPaymentID = ko.observable("");
  }
}

PageViewModel.prototype.showUserData = function() {
  var self = this;
  if (self.totalWorkers() < 1000) {
    self.json_data_modal_Visible(true);
    request('/user/' + self._originAddress, 300, function(data) {
      self.jsondatahtml().text(syntaxHighlight(JSON.stringify(data, undefined, 4)));
      self.loading_json_data_modal(false);
    });
  }
};

PageViewModel.prototype.showUserSettings = function() {
  var self = this;
  self.settings_modal_visible(true);
  self.settings_loading_modal(false);
};

PageViewModel.prototype.ok = function() {
  var self = this;
  self.modalVisible(false);
};

PageViewModel.prototype.switch_offline_workers = function() {
  var self = this;
  self.show_offline_workers(!self.show_offline_workers());
};


PageViewModel.prototype.loadApproximatedEarnings = function(callback) {
  var self = this;
  if (self.avghashrate().h6 === '--') {
    return callback();
  }
  request('/approximated_earnings/' + self.avghashrate().h6.replaceAll(',', ''), 60,
    function(data) {
      if (data === null) {
        callback();
        return;
      }
      self.calc().setValues(data);

      var hour = data.hour;

      self.prices(data.prices);

      self.hour_coins(hour.coins);
      self.hour_dollars(hour.dollars);
      self.hour_yuan(hour.yuan);
      self.hour_euros(hour.euros);
      self.hour_rubles(hour.rubles);
      self.hour_bitcoins(hour.bitcoins);
      self.hour_pounds(hour.pounds);

      callback();
    }
  );
};

PageViewModel.prototype.loadPrices = function(callback) {
  var self = this;
  request('/full_exchanges_data', 60,
    function(data) {
      self.prices(data);
    });
};

PageViewModel.prototype.setBalanceProgressBar = function() {
  var self = this;
  var calc_data = self.calc().data;
  var left = self.min_payout() - self.balance_float();

  if (left < 0) {
    self.balance_progress(100);
    self.balance_progress_striped(false);
    self.balance_progress_type('success');
    self.balance_progress_tooltip('You have reached minimum payout. Payment will be processed in next payment round.');
    self.balance_progress_visible(true);
    return;
  }
  if (calc_data) {
    var percent_left = (left / self.min_payout()) * 100;
    var percent_complete = (100 - percent_left).toFixed(2);
    var minutes_to_payout = left / calc_data.minute.coins;
    var seconds_to_payout = minutes_to_payout * 60;
    var a = moment();
    var a_unix = a.unix();
    var b_unix = a_unix + seconds_to_payout;
    var b = moment.unix(b_unix);
    var time_to = a.to(b);

    self.balance_progress_type('default');
    self.balance_progress_striped(true);
    self.balance_progress(percent_complete);
    self.balance_progress_tooltip(percent_complete + '% of your ' + self.min_payout() + ' ' + config.shortNameUpper + ' payout limit reached.' + (calc_data.minute.coins == 0 ? '' : ' You will reach limit ' + time_to + '(approximately)'));
    self.balance_progress_visible(true);
    return;
  }
  var percent_left = (left / self.min_payout()) * 100;
  var percent_complete = (100 - percent_left).toFixed(2);
  self.balance_progress_type('default');
  self.balance_progress_striped(true);
  self.balance_progress(percent_complete);
  self.balance_progress_tooltip(percent_complete + '% of your ' + self.min_payout() + ' ' + config.shortNameUpper + ' payout limit reached.');
  self.balance_progress_visible(true);
};

PageViewModel.prototype.initChart = function(hashrate, balance) {
  var self = this;
  var chart = $('#hr_chart').highcharts();
  if (chart !== undefined)
    chart.reflow();

  if (!self.workerPage())
    self.hashrate(new BigNumber(hashrate).toFormat(config.hashratePrecision));

  var b = parseFloat(balance);
  self.balance_float(b);
  self.balance(new BigNumber(Math.max(0, b)).toFormat(config.coinSigns));
};


PageViewModel.prototype.loadUserData = function() {
  var self = this;
  var time = Date.now();
  request('/load_account/' + self._originAddress + self._workerUrl, 30, function(data) {
    if (data === null) return new Error('No data loaded');
    var userParams = data.userParams;
    var avgHashRate = data.avgHashRate;
    if (config.shortName === 'pasc' && !userParams.pubkey && userParams.e_sum > 20 && self.pasc_public_alert) {
      self.pasc_public_alert('Please, set your public key in Settings panel to receive PASA');
    }
    self.min_payout(userParams.min_payout);
    self.usersettings().current_min_payout(self.min_payout());
    self.usersettings().current_pubkey(userParams.pubkey);
    self.message_db(userParams.message ? userParams.message : '');
    self.initChart(userParams.hashrate, userParams.balance);
    self.setShareRateHistory(data.shareRateHistory);

    if (config.hasUnconfirmedBalance)
      self.balance_unconfirmed(new BigNumber(Math.max(0, parseFloat(userParams.balance_unconfirmed))).toFormat(config.coinSigns));


    if (config.hasReportedHashrate)
      self.last_reported_hashrate(new BigNumber(userParams.reported).toFormat(config.hashratePrecision));

    var avgs = {
      h1: new BigNumber(avgHashRate.h1).toFormat(config.hashratePrecision),
      h3: new BigNumber(avgHashRate.h3).toFormat(config.hashratePrecision),
      h6: new BigNumber(avgHashRate.h6).toFormat(config.hashratePrecision),
      h12: new BigNumber(avgHashRate.h12).toFormat(config.hashratePrecision),
      h24: new BigNumber(avgHashRate.h24).toFormat(config.hashratePrecision)
    };


    self.avghashrate({
      h1: avgs.h1 === 'NaN' ? '--' : avgs.h1,
      h3: avgs.h3 === 'NaN' ? '--' : avgs.h3,
      h6: avgs.h6 === 'NaN' ? '--' : avgs.h6,
      h12: avgs.h12 === 'NaN' ? '--' : avgs.h12,
      h24: avgs.h24 === 'NaN' ? '--' : avgs.h24
    });

    self.avghashratetooltip("<div style='text-align: center'>" +
      "Calculated average hashrate<br>" +
      "1 hour:&nbsp&nbsp&nbsp&nbsp" + self.avghashrate().h1 + " " + config.hashrateUnits + " <br>" +
      "3 hours:&nbsp&nbsp&nbsp" + self.avghashrate().h3 + " " + config.hashrateUnits + " <br>" +
      "6 hours:&nbsp&nbsp&nbsp" + self.avghashrate().h6 + " " + config.hashrateUnits + " <br>" +
      "12 hours:&nbsp" + self.avghashrate().h12 + " " + config.hashrateUnits + " <br>" +
      "24 hours:&nbsp" + self.avghashrate().h24 + " " + config.hashrateUnits + " <br>" +
      "</div>");

    self.loadApproximatedEarnings(function() {
      self.setBalanceProgressBar();
      self.initChart(userParams.hashrate, userParams.balance);
    });

    self.loadPrices();

    self.totalWorkers(userParams.w_count);


    if (!self.workerPage()) {
      self.setWorkers(userParams);
      self.setPayments(userParams);
    } else {
      self.hashrate(new BigNumber(userParams.hashrate).toFormat(config.hashratePrecision));
      self.worker(userParams.worker_name);
    }
  });
};

PageViewModel.prototype.setShareRateHistory = function(data) {
  var self = this;
  if (data === undefined || data.length === 0)
    return;

  var array = [],
    pushNames = false,
    previos = '';
  if (Math.floor(data[0].hour) !== Math.floor(Date.now() / 3600000)) {
    array.push({
      date: gettext("Current hour"),
      amount: 0
    });
  } else {
    pushNames = true;
    previos = "Current hour";
  }
  array = array.concat(data.map(function(share, index) {
    var ms = share.hour * 3600 * 1000 - 1000,
      timestamp = moment(ms).format("MMM Do HH:mm:ss") + " (" + moment(ms).fromNow() + ")",
      obj = {
        date: pushNames ? previos : timestamp,
        amount: share.sum
      };
    if (pushNames) {
      previos = timestamp;
    }
    return obj;
  }));

  self.sharerates(array);
};

PageViewModel.prototype.setWorkers = function(data) {
  var self = this;

  if (data === undefined) {
    return;
  }

  self.workers().setOrigin(self._originAddress);

  self.workers().totalWorkers(data.w_count);
  ko.computed(function() {
    if (self.workers().status() === 'init' || self.workers().status() === 'ready') {
      self.workers().loadData();
    }
  });
};

PageViewModel.prototype.setPayments = function(data) {
  var self = this;
  if (self.workerPage()) return;
  if (data === undefined || data.e_count === undefined || data.e_count === 0) return;

  self.payments().total_paid(parseFloat(data.e_sum));
  self.payments().totalPayments(parseFloat(data.e_count));

  ko.computed(function() {
    var offset = ((self.payments().currentPage() - 1) * self.payments().numPerPage());
    var limit = self.payments().numPerPage();
    request('/payments/' + self._originAddress + '/' + offset + '/' + limit, 60, function(data) {
      if (data === undefined || data.count === 0)
        return;
      var arr = []
      data.forEach(function(p) {
        var unixDate = p.date;
        var date = moment.unix(unixDate).format('YYYY-MM-DD HH:mm:ss');
        var amount = parseFloat(p.amount);
        var payment = new Payment(p.txHash, date, amount, p.confirmed, null);
        arr.push(payment);
      });
      self.payments().payments(arr);
    });
  });
  if (config.hasAltPayments !== undefined && config.hasAltPayments) {
    if (data.ae_count === undefined || data.ae_count === 0) return;

    self.altpayments().total_paid(parseFloat(data.ae_sum));
    self.altpayments().totalPayments(parseFloat(data.ae_count));

    ko.computed(function() {
      var begin = ((self.altpayments().currentPage() - 1) * self.altpayments().numPerPage());
      request('/altpayments/' + self._originAddress + '/' + begin + '/' + self.altpayments().numPerPage(), 60, function(data) {
        if (data === undefined || data.count === 0)
          return;
        var arr = []
        data.forEach(function(p) {
          var unixDate = p.date;
          var date = moment.unix(unixDate).format('YYYY-MM-DD HH:mm:ss');
          var amount = parseFloat(p.amount);
          var payment = new Payment(p.txHash, date, amount, p.confirmed, p.extra);
          arr.push(payment);
        });
        self.altpayments().payments(arr);
      });
    });
  }
};

function PageViewModel(currecny) {

  var self = this;
  self.parseAddress();
  self.init(currecny);
  self.replaceAddressByExchange();
  self.paymentID = ko.observable(self._paymentID === undefined ? '' : self._paymentID);
  self.address = ko.observable(self._address);
  self.originAddress = ko.observable(self._originAddress);
  self.checkWrongLengthAddress();
  self.usersettings = ko.observable(new UserSettings(self.originAddress(), self));
  if (config.shortNameUpper === 'ZEC' && self.originAddress().indexOf('t') !== 0) {
    self.zec_alert(gettext('Only public addresses (t-addr) are supported now.'));
  }

  self.loadUserData();
}
