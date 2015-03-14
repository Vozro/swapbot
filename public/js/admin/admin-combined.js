(function() {
  var sbAdmin;

  sbAdmin = {
    ctrl: {}
  };

  sbAdmin.api = (function() {
    var api, newNonce, signRequest, signURLParameters;
    api = {};
    signRequest = function(xhr, xhrOptions) {
      var credentials, nonce, paramsBody, signature, url, _ref;
      credentials = sbAdmin.auth.getCredentials();
      if (!((_ref = credentials.apiToken) != null ? _ref.length : void 0)) {
        return;
      }
      nonce = newNonce();
      if ((xhrOptions.data != null) && xhrOptions.data !== 'null') {
        if (typeof xhrOptions.data === 'object') {
          paramsBody = window.JSON.stringify(xhrOptions.data);
        } else {
          paramsBody = xhrOptions.data;
        }
      } else {
        paramsBody = '{}';
      }
      url = window.location.protocol + '//' + window.location.host + xhrOptions.url;
      signature = signURLParameters(xhrOptions.method, url, paramsBody, nonce, credentials);
      xhr.setRequestHeader('X-Tokenly-Auth-Nonce', nonce);
      xhr.setRequestHeader('X-Tokenly-Auth-Api-Token', credentials.apiToken);
      xhr.setRequestHeader('X-Tokenly-Auth-Signature', signature);
    };
    signURLParameters = function(method, url, paramsBody, nonce, credentials) {
      var hmacMessage, signature;
      hmacMessage = method + "\n" + url + "\n" + paramsBody + "\n" + credentials.apiToken + "\n" + nonce;
      signature = CryptoJS.HmacSHA256(hmacMessage, credentials.apiSecretKey).toString(CryptoJS.enc.Base64);
      return signature;
    };
    newNonce = function() {
      return Math.round(0 + new Date() / 1000);
    };
    api.getSelf = function() {
      return api.send('GET', 'users/me');
    };
    api.newBot = function(botAttributes) {
      return api.send('POST', 'bots', botAttributes);
    };
    api.updateBot = function(id, botAttributes) {
      return api.send('PUT', "bots/" + id, botAttributes);
    };
    api.getAllBots = function() {
      return api.send('GET', 'bots');
    };
    api.getBot = function(id) {
      return api.send('GET', "bots/" + id);
    };
    api.getBotEvents = function(id, additionalOpts) {
      if (additionalOpts == null) {
        additionalOpts = {};
      }
      return api.send('GET', "botevents/" + id, null, additionalOpts);
    };
    api.refreshBalances = function(id) {
      return api.send('POST', "balancerefresh/" + id, null, {
        background: true
      });
    };
    api.newUser = function(userAttributes) {
      return api.send('POST', 'users', userAttributes);
    };
    api.updateUser = function(id, userAttributes) {
      return api.send('PUT', "users/" + id, userAttributes);
    };
    api.getAllUsers = function() {
      return api.send('GET', 'users');
    };
    api.getUser = function(id) {
      return api.send('GET', "users/" + id);
    };
    api.getBotPaymentBalance = function(id) {
      return api.send('GET', "payments/" + id + "/balance");
    };
    api.getAllBotPayments = function(id) {
      return api.send('GET', "payments/" + id + "/all");
    };
    api.send = function(method, apiPathSuffix, params, additionalOpts) {
      var k, opts, path, v;
      if (params == null) {
        params = null;
      }
      if (additionalOpts == null) {
        additionalOpts = {};
      }
      path = '/api/v1/' + apiPathSuffix;
      opts = {
        method: method,
        url: path,
        data: params,
        config: signRequest
      };
      for (k in additionalOpts) {
        v = additionalOpts[k];
        opts[k] = v;
      }
      return m.request(opts);
    };
    return api;
  })();

  sbAdmin.auth = (function() {
    var auth;
    auth = {};
    auth.redirectIfNotLoggedIn = function() {
      if (!auth.isLoggedIn()) {
        m.route('/admin/login');
      }
    };
    auth.isLoggedIn = function() {
      var credentials, _ref, _ref1;
      credentials = auth.getCredentials();
      if (((_ref = credentials.apiToken) != null ? _ref.length : void 0) > 0 && ((_ref1 = credentials.apiSecretKey) != null ? _ref1.length : void 0) > 0) {
        return true;
      }
      return false;
    };
    auth.getUser = function() {
      var user;
      user = window.JSON.parse(localStorage.getItem("user"));
      if (!user) {
        return {};
      }
      return user;
    };
    auth.login = function(apiToken, apiSecretKey) {
      window.localStorage.setItem("apiToken", apiToken);
      window.localStorage.setItem("apiSecretKey", apiSecretKey);
      return sbAdmin.api.getSelf().then(function(user) {
        window.localStorage.setItem("user", window.JSON.stringify(user));
        return user;
      });
    };
    auth.logout = function() {
      window.localStorage.removeItem("apiToken");
      window.localStorage.removeItem("apiSecretKey");
      window.localStorage.removeItem("user");
    };
    auth.getCredentials = function() {
      return {
        apiToken: localStorage.getItem("apiToken"),
        apiSecretKey: localStorage.getItem("apiSecretKey")
      };
    };
    return auth;
  })();

  sbAdmin.currencyutils = (function() {
    var SATOSHI, currencyutils;
    currencyutils = {};
    SATOSHI = 100000000;
    currencyutils.satoshisToValue = function(amount, currencyPostfix) {
      if (currencyPostfix == null) {
        currencyPostfix = 'BTC';
      }
      return currencyutils.formatValue(amount / SATOSHI, currencyPostfix);
    };
    currencyutils.formatValue = function(value, currencyPostfix) {
      if (currencyPostfix == null) {
        currencyPostfix = 'BTC';
      }
      return window.numeral(value).format('0.0[0000000]') + (currencyPostfix.length ? ' ' + currencyPostfix : '');
    };
    return currencyutils;
  })();

  sbAdmin.formGroup = (function() {
    var buildGroupProp, buildNewItem, buildRemoveItemFn, groupBuilder;
    groupBuilder = {};
    buildGroupProp = function(config) {
      var emptyItem;
      emptyItem = buildNewItem(config);
      return m.prop([emptyItem]);
    };
    buildNewItem = function(config, defaultValues) {
      var emptyItem, fieldDef, value, _i, _len, _ref;
      if (defaultValues == null) {
        defaultValues = null;
      }
      emptyItem = {};
      _ref = config.fields;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        fieldDef = _ref[_i];
        value = '';
        if (defaultValues != null ? defaultValues[fieldDef.name] : void 0) {
          value = defaultValues[fieldDef.name];
        }
        emptyItem[fieldDef.name] = m.prop(value);
      }
      return emptyItem;
    };
    buildRemoveItemFn = function(number, groupProp) {
      return function(e) {
        var newItems;
        e.preventDefault();
        newItems = groupProp().filter(function(item, index) {
          return index !== number - 1;
        });
        groupProp(newItems);
      };
    };
    groupBuilder.newGroup = function(config) {
      var formGroup, idPrefix, newRowBuilder, numberOfColumns;
      formGroup = {};
      idPrefix = config.id || "group";
      config.displayOnly = config.displayOnly || false;
      numberOfColumns = config.displayOnly ? 12 : 11;
      newRowBuilder = function(number, item) {
        var rowBuilder;
        rowBuilder = {};
        rowBuilder.field = function(labelText, propName, placeholder_or_attributes, overrideColumnWidth) {
          var attrs, el, id, prop;
          if (placeholder_or_attributes == null) {
            placeholder_or_attributes = null;
          }
          if (overrideColumnWidth == null) {
            overrideColumnWidth = null;
          }
          prop = item[propName];
          id = "" + idPrefix + "_" + propName + "_" + number;
          if (typeof placeholder_or_attributes === 'object') {
            attrs = placeholder_or_attributes;
            attrs.id = attrs.id || id;
          } else {
            attrs = {
              id: id
            };
            if (placeholder_or_attributes) {
              attrs.placeholder = placeholder_or_attributes;
            }
          }
          if (labelText === null) {
            el = sbAdmin.form.mInputEl(attrs, prop);
          } else {
            el = sbAdmin.form.mFormField(labelText, attrs, prop);
          }
          return {
            colWidth: overrideColumnWidth,
            el: el
          };
        };
        rowBuilder.value = function(labelText, propName, attributes, overrideColumnWidth) {
          var attrs, el, id, prop;
          if (attributes == null) {
            attributes = null;
          }
          if (overrideColumnWidth == null) {
            overrideColumnWidth = null;
          }
          prop = item[propName];
          id = "" + idPrefix + "_" + propName + "_" + number;
          if (typeof attributes === 'object') {
            attrs = attributes;
            attrs.id = attrs.id || id;
          } else {
            attrs = {
              id: id
            };
          }
          if (labelText === null) {
            el = m("span", {}, prop());
          } else {
            el = sbAdmin.form.mValueDisplay(labelText, attrs, prop());
          }
          return {
            colWidth: overrideColumnWidth,
            el: el
          };
        };
        rowBuilder.header = function(headerText) {
          return m("h4", headerText);
        };
        rowBuilder.row = function(rowBuilderFieldDefs) {
          var colEls, colSizes, overrides, rowBuilderFieldDef, rowBuilderFieldDefsCount;
          rowBuilderFieldDefsCount = rowBuilderFieldDefs.length;
          overrides = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = rowBuilderFieldDefs.length; _i < _len; _i++) {
              rowBuilderFieldDef = rowBuilderFieldDefs[_i];
              _results.push(rowBuilderFieldDef.colWidth);
            }
            return _results;
          })();
          colSizes = sbAdmin.utils.splitColumnsWithOverrides(rowBuilderFieldDefsCount, numberOfColumns, overrides);
          colEls = rowBuilderFieldDefs.map(function(rowBuilderFieldDef, offset) {
            return m("div", {
              "class": "col-md-" + colSizes[offset]
            }, rowBuilderFieldDef.el);
          });
          if (!config.displayOnly) {
            colEls.push(m("div", {
              "class": "col-md-1"
            }, [
              m("a", {
                "class": "remove-link" + (config.useCompactNumberedLayout != null ? " remove-link-compact" : ""),
                href: '#remove',
                onclick: buildRemoveItemFn(number, formGroup.prop),
                style: number === 1 ? {
                  display: 'none'
                } : ""
              }, [
                m("span", {
                  "class": "glyphicon glyphicon-remove-circle",
                  title: "Remove Item " + number
                }, '')
              ])
            ]));
          }
          return m("div", {
            "class": "item-group" + (config.useCompactNumberedLayout != null ? " form-group" : "")
          }, [
            m("div", {
              "class": "row"
            }, colEls)
          ]);
        };
        return rowBuilder;
      };
      formGroup.prop = buildGroupProp(config);
      formGroup.buildInputs = function() {
        var inputs;
        if (config.buildAllItemRows != null) {
          return config.buildAllItemRows(formGroup.prop());
        }
        inputs = formGroup.prop().map(function(item, offset) {
          var number, row;
          number = offset + 1;
          row = config.buildItemRow(newRowBuilder(number, item), number, item);
          return row;
        });
        inputs.push(m("div", {
          "class": "form-group"
        }, [
          m("a", {
            "class": "",
            href: '#add',
            onclick: formGroup.addItem
          }, [
            m("span", {
              "class": "glyphicon glyphicon-plus"
            }, ''), m("span", {}, " " + (config.addLabel || "Add Another Item"))
          ])
        ]));
        return inputs;
      };
      formGroup.buildValues = function() {
        var values;
        if (config.buildAllItemRows != null) {
          return config.buildAllItemRows(formGroup.prop());
        }
        values = formGroup.prop().map(function(item, offset) {
          var number, row;
          number = offset + 1;
          row = config.buildItemRow(newRowBuilder(number, item), number, item);
          return row;
        });
        return values;
      };
      formGroup.addItem = function(e) {
        var emptyItem;
        e.preventDefault();
        emptyItem = buildNewItem(config);
        formGroup.prop().push(emptyItem);
      };
      formGroup.unserialize = function(itemsData) {
        var itemData, newItems, rawItemData, _i, _len;
        newItems = [];
        for (_i = 0, _len = itemsData.length; _i < _len; _i++) {
          rawItemData = itemsData[_i];
          if (config.translateFieldToNumberedValues != null) {
            itemData = {};
            itemData[config.translateFieldToNumberedValues] = rawItemData;
          } else {
            itemData = rawItemData;
          }
          newItems.push(buildNewItem(config, itemData));
        }
        if (!itemsData || !itemsData.length) {
          newItems.push(buildNewItem(config));
        }
        formGroup.prop(newItems);
      };
      formGroup.serialize = function() {
        var prop, serializedData, _i, _len, _ref;
        if (config.translateFieldToNumberedValues != null) {
          serializedData = [];
          _ref = formGroup.prop();
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            prop = _ref[_i];
            serializedData.push(prop[config.translateFieldToNumberedValues]());
          }
        } else {
          serializedData = formGroup.prop();
        }
        return serializedData;
      };
      return formGroup;
    };
    return groupBuilder;
  })();

  sbAdmin.form = (function() {
    var form;
    form = {};
    form.mValueDisplay = function(label, attributes, value) {
      var id, inputEl, inputProps;
      inputProps = sbAdmin.utils.clone(attributes);
      if (inputProps["class"] == null) {
        inputProps["class"] = 'form-control-static';
      }
      id = inputProps.id || 'value';
      return m("div", {
        "class": "form-group"
      }, [
        m("label", {
          "for": id,
          "class": 'control-label'
        }, label), inputEl = m("div", inputProps, value)
      ]);
    };
    form.mFormField = function(label, attributes, prop) {
      var inputEl;
      inputEl = form.mInputEl(attributes, prop);
      return m("div", {
        "class": "form-group"
      }, [
        m("label", {
          "for": attributes.id,
          "class": 'control-label'
        }, label), inputEl
      ]);
    };
    form.mInputEl = function(attributes, prop) {
      var inputEl, inputProps, name, options;
      inputProps = sbAdmin.utils.clone(attributes);
      name = inputProps.name || inputProps.id;
      inputProps.onchange = m.withAttr("value", prop);
      inputProps.value = prop();
      if (inputProps["class"] == null) {
        inputProps["class"] = 'form-control';
      }
      if (inputProps.name == null) {
        inputProps.name = inputProps.id;
      }
      switch (inputProps.type) {
        case 'textarea':
          delete inputProps.type;
          inputProps.rows = inputProps.rows || 3;
          inputEl = m("textarea", inputProps);
          break;
        case 'select':
          delete inputProps.type;
          options = inputProps.options || {
            '': '- None -'
          };
          inputEl = m("select", inputProps, options.map(function(opt) {
            return m("option", {
              value: opt.v,
              label: opt.k
            });
          }));
          break;
        default:
          inputEl = m("input", inputProps);
      }
      return inputEl;
    };
    form.mSubmitBtn = function(label) {
      return m("button", {
        type: 'submit',
        "class": 'btn btn-primary'
      }, label);
    };
    form.mAlerts = function(errorsProp) {
      if (errorsProp().length === 0) {
        return null;
      }
      return m("div", {
        "class": "alert alert-danger",
        role: "alert"
      }, [
        m("strong", "An error occurred."), m("ul", {
          "class": "list-unstyled"
        }, [
          errorsProp().map(function(errorMsg) {
            return m('li', errorMsg);
          })
        ])
      ]);
    };
    form.mForm = function(props, elAttributes, children) {
      var formAttributes, status;
      formAttributes = sbAdmin.utils.clone(elAttributes);
      if (props.status != null) {
        status = props.status();
      }
      if (status === 'submitting') {
        formAttributes.style = {
          opacity: 0.25
        };
      }
      return m("form", formAttributes, children);
    };
    form.submit = function(apiCallFn, apiCallArgs, errorsProp, formStatusProp) {
      if (formStatusProp() === 'submitting') {
        return;
      }
      errorsProp([]);
      formStatusProp('submitting');
      return apiCallFn.apply(null, apiCallArgs).then(function(apiResponse) {
        formStatusProp('submitted');
        return apiResponse;
      }, function(error) {
        formStatusProp('active');
        errorsProp(error.errors);
        return m.deferred().reject(error).promise;
      });
    };
    return form;
  })();

  sbAdmin.nav = (function() {
    var buildRightNav, buildUsersNavLink, nav;
    nav = {};
    buildRightNav = function(user) {
      var username;
      username = user != null ? user.name : void 0;
      if (username) {
        return m("ul", {
          "class": "nav navbar-nav navbar-right"
        }, [
          m("li", {
            "class": "dropdown"
          }, [
            m("a[href=#]", {
              "class": "dropdown-toggle",
              "data-toggle": "dropdown",
              "role": "button",
              "aria-expanded": "false"
            }, [
              username, m("span", {
                "class": "caret"
              })
            ]), m("ul", {
              "class": "dropdown-menu",
              role: "menu"
            }, [
              m("li", {
                "class": ""
              }, [
                m("a[href='/admin/logout']", {
                  "class": "",
                  config: m.route
                }, "Logout")
              ])
            ])
          ])
        ]);
      } else {
        return m("ul", {
          "class": "nav navbar-nav navbar-right"
        }, [
          m("li", {
            "class": ""
          }, [
            m("a[href='/admin/login']", {
              "class": "",
              config: m.route
            }, "Login")
          ])
        ]);
      }
    };
    buildUsersNavLink = function(user) {
      var _ref;
      if ((_ref = user.privileges) != null ? _ref.createUser : void 0) {
        return m("li", {
          "class": ""
        }, [
          m("a[href='/admin/users']", {
            "class": "",
            config: m.route
          }, "Users")
        ]);
      }
      return null;
    };
    nav.buildNav = function() {
      var user;
      user = sbAdmin.auth.getUser();
      return m("nav", {
        "class": "navbar navbar-default"
      }, [
        m("div", {
          "class": "container-fluid"
        }, [
          m("div", {
            "class": "navbar-header"
          }, [
            m("a[href='/admin/dashboard']", {
              "class": "navbar-brand",
              config: m.route
            }, "Swapbot Admin")
          ]), m("ul", {
            "class": "nav navbar-nav"
          }, [
            m("li", {
              "class": ""
            }, [
              m("a[href='/admin/dashboard']", {
                "class": "",
                config: m.route
              }, "Dashboard")
            ]), m("li", {
              "class": ""
            }, [
              m("a[href='/admin/edit/bot/new']", {
                "class": "",
                config: m.route
              }, "New Bot")
            ]), buildUsersNavLink(user)
          ]), buildRightNav(user)
        ])
      ]);
    };
    nav.buildInContainer = function(mEl) {
      return m("div", {
        "class": "container",
        style: {
          marginTop: "0px",
          marginBottom: "24px"
        }
      }, [
        m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-12 col-lg-10 col-lg-offset-1"
          }, [mEl])
        ])
      ]);
    };
    return nav;
  })();

  sbAdmin.planutils = (function() {
    var planutils;
    planutils = {};
    planutils.paymentPlanDesc = function(planID) {
      var _ref;
      return ((_ref = planutils.planData(planID)) != null ? _ref.name : void 0) || 'unknown';
    };
    planutils.planData = function(planID) {
      var plans;
      plans = planutils.allPlansData();
      if (plans[planID] != null) {
        return plans[planID];
      }
      return null;
    };
    planutils.allPlansData = function() {
      var initialFuel;
      initialFuel = 0.01;
      return {
        txfee001: {
          id: "txfee001",
          name: "0.005 BTC creation fee + .001 BTC per TX",
          creationFee: 0.005,
          txFee: 0.001,
          initialFuel: initialFuel
        },
        txfee002: {
          id: "txfee002",
          name: "0.05 BTC creation fee + .0005 BTC per TX",
          creationFee: 0.05,
          txFee: 0.0005,
          initialFuel: initialFuel
        },
        txfee003: {
          id: "txfee003",
          name: "0.5 BTC creation fee + .0001 BTC per TX",
          creationFee: 0.5,
          txFee: 0.0001,
          initialFuel: initialFuel
        }
      };
    };
    planutils.allPlanOptions = function() {
      var k, opts, v;
      opts = (function() {
        var _ref, _results;
        _ref = planutils.allPlansData();
        _results = [];
        for (k in _ref) {
          v = _ref[k];
          _results.push({
            k: v.name,
            v: v.id
          });
        }
        return _results;
      })();
      return opts;
    };
    return planutils;
  })();

  sbAdmin.pusherutils = (function() {
    var pusherutils;
    pusherutils = {};
    pusherutils.subscribeToPusherChannel = function(channelName, callbackFn) {
      var client;
      client = new window.Faye.Client("" + window.PUSHER_URL + "/public");
      client.subscribe("/" + channelName, function(data) {
        callbackFn(data);
      });
      return client;
    };
    pusherutils.closePusherChannel = function(client) {
      client.disconnect();
    };
    return pusherutils;
  })();

  sbAdmin.stateutils = (function() {
    var stateutils;
    stateutils = {};
    stateutils.buildStateSpan = function(stateValue) {
      switch (stateValue) {
        case 'brandnew':
          return m("span", {
            "class": 'no'
          }, stateutils.buildStateLabel(stateValue));
        case 'lowfuel':
          return m("span", {
            "class": 'no'
          }, stateutils.buildStateLabel(stateValue));
        case 'active':
          return m("span", {
            "class": 'yes'
          }, stateutils.buildStateLabel(stateValue));
        default:
          return m("span", {
            "class": 'no'
          }, stateutils.buildStateLabel(stateValue));
      }
    };
    stateutils.buildStateLabel = function(stateValue) {
      switch (stateValue) {
        case 'brandnew':
          return "Waiting for Payment";
        case 'lowfuel':
          return "Low Fuel";
        case 'active':
          return "Active";
        default:
          return "Inactive";
      }
    };
    stateutils.buildStateDetails = function(stateValue, planName, paymentAddress, botAddress) {
      var amount, details, planDetails;
      details = {
        label: '',
        subtitle: '',
        "class": ''
      };
      switch (stateValue) {
        case 'brandnew':
          planDetails = sbAdmin.planutils.planData(planName);
          amount = planDetails.creationFee + planDetails.initialFuel;
          details.label = stateutils.buildStateLabel(stateValue);
          details.subtitle = "This is a new swapbot and needs to be paid to be activated.  Please send a payment of " + (sbAdmin.currencyutils.formatValue(amount)) + " to " + paymentAddress + ".  This is a payment of " + planDetails.creationFee + " BTC for the creation of the bot and " + planDetails.initialFuel + " BTC as fuel to send transactions.";
          details["class"] = "panel-warning inactive new";
          break;
        case 'lowfuel':
          details.label = stateutils.buildStateLabel(stateValue);
          details.subtitle = "This swapbot is low on BTC fuel.  Please send 0.005 BTC to " + paymentAddress + ".";
          details["class"] = "panel-warning inactive lowfuel";
          break;
        case 'active':
          details.label = stateutils.buildStateLabel(stateValue);
          details.subtitle = "This swapbot is up and running.  All is well.";
          details["class"] = "panel-success active";
          break;
        default:
          details.label = stateutils.buildStateLabel(stateValue);
          details.subtitle = "This swapbot is inactive.  Swaps are not being processed.";
          details["class"] = "panel-danger inactive deactivated";
      }
      return details;
    };
    stateutils.buildStateDisplay = function(details) {
      return m("div", {
        "class": "panel " + details["class"]
      }, [
        m("div", {
          "class": 'panel-heading'
        }, [
          m("h3", {
            "class": 'panel-title'
          }, details.label)
        ]), m("div", {
          "class": 'panel-body'
        }, details.subtitle)
      ]);
    };
    return stateutils;
  })();

  sbAdmin.swaputils = (function() {
    var strategyLabelCache, swaputils;
    swaputils = {};
    swaputils.newSwapProp = function(swap) {
      if (swap == null) {
        swap = {};
      }
      return m.prop({
        strategy: m.prop(swap.strategy || 'rate'),
        "in": m.prop(swap["in"] || ''),
        out: m.prop(swap.out || ''),
        rate: m.prop(swap.rate || ''),
        in_qty: m.prop(swap.in_qty || ''),
        out_qty: m.prop(swap.out_qty || '')
      });
    };
    swaputils.allStrategyOptions = function() {
      return [
        {
          k: "By Rate",
          v: 'rate'
        }, {
          k: "By Fixed Amounts",
          v: 'fixed'
        }
      ];
    };
    strategyLabelCache = null;
    swaputils.strategyLabelByValue = function(strategyValue) {
      if (strategyLabelCache === null) {
        strategyLabelCache = {};
        swaputils.allStrategyOptions().map(function(opt) {
          strategyLabelCache[opt.v] = opt.k;
        });
      }
      return strategyLabelCache[strategyValue];
    };
    return swaputils;
  })();

  sbAdmin.utils = (function() {
    var utils;
    utils = {};
    utils.clone = function(obj) {
      var attr, copy;
      if (null === obj || "object" !== typeof obj) {
        return obj;
      }
      copy = obj.constructor();
      for (attr in obj) {
        if (obj.hasOwnProperty(attr)) {
          copy[attr] = obj[attr];
        }
      }
      return copy;
    };
    utils.isEmpty = function(obj) {
      var key;
      if (obj == null) {
        return true;
      }
      if (obj.length > 0) {
        return false;
      }
      if (obj.length === 0) {
        return true;
      }
      for (key in obj) {
        if (hasOwnProperty.call(obj, key)) {
          return false;
        }
      }
      return true;
    };
    utils.splitColumns = function(elementsCount, totalColumns) {
      var baseColSize, colSize, cols, cumRemainder, i, isLast, remainder, totalColsUsed, _i;
      baseColSize = Math.floor(totalColumns / elementsCount);
      remainder = totalColumns % elementsCount;
      cumRemainder = 0;
      totalColsUsed = 0;
      cols = [];
      for (i = _i = 0; 0 <= elementsCount ? _i < elementsCount : _i > elementsCount; i = 0 <= elementsCount ? ++_i : --_i) {
        isLast = i === elementsCount - 1;
        if (isLast) {
          colSize = totalColumns - totalColsUsed;
        } else {
          colSize = baseColSize;
          cumRemainder += remainder;
          if (cumRemainder >= elementsCount) {
            cumRemainder -= elementsCount;
            ++colSize;
          }
          totalColsUsed += colSize;
        }
        cols.push(colSize);
      }
      return cols;
    };
    utils.splitColumnsWithOverrides = function(elementsCount, totalColumns, overrides) {
      var cols, colsToSplit, elsToSplit, i, nextSplitColumnOffset, overrideCol, overrideCols, splitColumns, _i, _j, _len;
      overrideCols = [];
      elsToSplit = elementsCount;
      colsToSplit = totalColumns;
      for (i = _i = 0; 0 <= elementsCount ? _i < elementsCount : _i > elementsCount; i = 0 <= elementsCount ? ++_i : --_i) {
        if (overrides != null ? overrides[i] : void 0) {
          overrideCols.push(overrides[i]);
          colsToSplit -= overrides[i];
          elsToSplit -= 1;
        } else {
          overrideCols.push(-1);
        }
      }
      splitColumns = utils.splitColumns(elsToSplit, colsToSplit);
      cols = [];
      nextSplitColumnOffset = 0;
      for (_j = 0, _len = overrideCols.length; _j < _len; _j++) {
        overrideCol = overrideCols[_j];
        if (overrideCol === -1) {
          cols.push(splitColumns[nextSplitColumnOffset]);
          ++nextSplitColumnOffset;
        } else {
          cols.push(overrideCol);
        }
      }
      return cols;
    };
    return utils;
  })();

  window.utils = sbAdmin.utils;

  (function() {
    var buildBlacklistAddressesGroup, buildIncomeRulesGroup, swapGroup, swapGroupRenderers, vm;
    sbAdmin.ctrl.botForm = {};
    swapGroupRenderers = {};
    swapGroupRenderers.rate = function(number, swap) {
      return m("div", {
        "class": "asset-group"
      }, [
        m("h4", "Swap #" + number), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mFormField("Swap Type", {
              id: "swap_strategy_" + number,
              type: 'select',
              options: sbAdmin.swaputils.allStrategyOptions()
            }, swap.strategy)
          ]), m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mFormField("Receives Asset", {
              id: "swap_in_" + number,
              'placeholder': "BTC"
            }, swap["in"])
          ]), m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mFormField("Sends Asset", {
              id: "swap_out_" + number,
              'placeholder': "LTBCOIN"
            }, swap.out)
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mFormField("At Rate", {
              type: "number",
              step: "any",
              min: "0",
              id: "swap_rate_" + number,
              'placeholder': "0.000001"
            }, swap.rate)
          ]), m("div", {
            "class": "col-md-1"
          }, [
            m("a", {
              "class": "remove-link",
              href: '#remove',
              onclick: vm.buildRemoveSwapFn(number),
              style: number === 1 ? {
                display: 'none'
              } : ""
            }, [
              m("span", {
                "class": "glyphicon glyphicon-remove-circle",
                title: "Remove Swap " + number
              }, '')
            ])
          ])
        ])
      ]);
    };
    swapGroupRenderers.fixed = function(number, swap) {
      return m("div", {
        "class": "asset-group"
      }, [
        m("h4", "Swap #" + number), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mFormField("Swap Type", {
              id: "swap_strategy_" + number,
              type: 'select',
              options: sbAdmin.swaputils.allStrategyOptions()
            }, swap.strategy)
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mFormField("Receives Asset", {
              id: "swap_in_" + number,
              'placeholder': "BTC"
            }, swap["in"])
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mFormField("Receives Quantity", {
              type: "number",
              step: "any",
              min: "0",
              id: "swap_in_qty_" + number,
              'placeholder': "1"
            }, swap.in_qty)
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mFormField("Sends Asset", {
              id: "swap_out_" + number,
              'placeholder': "LTBCOIN"
            }, swap.out)
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mFormField("Sends Quantity", {
              type: "number",
              step: "any",
              min: "0",
              id: "swap_out_qty_" + number,
              'placeholder': "1"
            }, swap.out_qty)
          ]), m("div", {
            "class": "col-md-1"
          }, [
            m("a", {
              "class": "remove-link",
              href: '#remove',
              onclick: vm.buildRemoveSwapFn(number),
              style: number === 1 ? {
                display: 'none'
              } : ""
            }, [
              m("span", {
                "class": "glyphicon glyphicon-remove-circle",
                title: "Remove Swap " + number
              }, '')
            ])
          ])
        ])
      ]);
    };
    swapGroup = function(number, swapProp) {
      return swapGroupRenderers[swapProp().strategy()](number, swapProp());
    };
    buildIncomeRulesGroup = function() {
      return sbAdmin.formGroup.newGroup({
        id: 'incomerules',
        fields: [
          {
            name: 'asset'
          }, {
            name: 'minThreshold'
          }, {
            name: 'paymentAmount'
          }, {
            name: 'address'
          }
        ],
        addLabel: "Add Another Income Forwarding Rule",
        buildItemRow: function(builder, number, item) {
          return [
            builder.header("Income Forwarding Rule #" + number), builder.row([
              builder.field("Asset Received", 'asset', 'BTC', 3), builder.field("Trigger Threshold", 'minThreshold', {
                type: "number",
                step: "any",
                min: "0",
                placeholder: "1.0"
              }), builder.field("Payment Amount", 'paymentAmount', {
                type: "number",
                step: "any",
                min: "0",
                placeholder: "0.5"
              }), builder.field("Payment Address", 'address', "1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", 4)
            ])
          ];
        }
      });
    };
    buildBlacklistAddressesGroup = function() {
      return sbAdmin.formGroup.newGroup({
        id: 'blacklist',
        fields: [
          {
            name: 'address'
          }
        ],
        addLabel: " Add Another Blacklist Address",
        buildItemRow: function(builder, number, item) {
          return [builder.row([builder.field(null, 'address', "1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", 4)])];
        },
        translateFieldToNumberedValues: 'address',
        useCompactNumberedLayout: true
      });
    };
    vm = sbAdmin.ctrl.botForm.vm = (function() {
      var buildBlacklistAddressesPropValue, buildSwapsPropValue;
      buildSwapsPropValue = function(swaps) {
        var out, swap, _i, _len;
        out = [];
        for (_i = 0, _len = swaps.length; _i < _len; _i++) {
          swap = swaps[_i];
          out.push(sbAdmin.swaputils.newSwapProp(swap));
        }
        if (!out.length) {
          out.push(sbAdmin.swaputils.newSwapProp());
        }
        return out;
      };
      buildBlacklistAddressesPropValue = function(addresses) {
        var address, out, _i, _len;
        out = [];
        for (_i = 0, _len = addresses.length; _i < _len; _i++) {
          address = addresses[_i];
          out.push(m.prop(address));
        }
        if (!out.length) {
          out.push(m.prop(''));
        }
        return out;
      };
      vm = {};
      vm.init = function() {
        var id;
        vm.errorMessages = m.prop([]);
        vm.formStatus = m.prop('active');
        vm.resourceId = m.prop('');
        vm.name = m.prop('');
        vm.description = m.prop('');
        vm.paymentPlan = m.prop('');
        vm.returnFee = m.prop(0.0001);
        vm.confirmationsRequired = m.prop(2);
        vm.swaps = m.prop([sbAdmin.swaputils.newSwapProp()]);
        vm.incomeRulesGroup = buildIncomeRulesGroup();
        vm.blacklistAddressesGroup = buildBlacklistAddressesGroup();
        id = m.route.param('id');
        vm.isNew = id === 'new';
        if (!vm.isNew) {
          sbAdmin.api.getBot(id).then(function(botData) {
            vm.resourceId(botData.id);
            vm.name(botData.name);
            vm.description(botData.description);
            vm.paymentPlan(botData.paymentPlan);
            vm.swaps(buildSwapsPropValue(botData.swaps));
            vm.returnFee(botData.returnFee || "0.0001");
            vm.confirmationsRequired(botData.confirmationsRequired || "2");
            vm.incomeRulesGroup.unserialize(botData.incomeRules);
            vm.blacklistAddressesGroup.unserialize(botData.blacklistAddresses);
          }, function(errorResponse) {
            vm.errorMessages(errorResponse.errors);
          });
        }
        vm.addSwap = function(e) {
          e.preventDefault();
          vm.swaps().push(sbAdmin.swaputils.newSwapProp());
        };
        vm.buildRemoveSwapFn = function(number) {
          return function(e) {
            var newSwaps;
            e.preventDefault();
            newSwaps = vm.swaps().filter(function(swap, index) {
              return index !== number - 1;
            });
            vm.swaps(newSwaps);
          };
        };
        vm.save = function(e) {
          var apiArgs, apiCall, attributes;
          e.preventDefault();
          attributes = {
            name: vm.name(),
            description: vm.description(),
            paymentPlan: vm.paymentPlan(),
            swaps: vm.swaps(),
            returnFee: vm.returnFee() + "",
            incomeRules: vm.incomeRulesGroup.serialize(),
            blacklistAddresses: vm.blacklistAddressesGroup.serialize(),
            confirmationsRequired: vm.confirmationsRequired() + ""
          };
          if (vm.resourceId().length > 0) {
            apiCall = sbAdmin.api.updateBot;
            apiArgs = [vm.resourceId(), attributes];
          } else {
            apiCall = sbAdmin.api.newBot;
            apiArgs = [attributes];
          }
          return sbAdmin.form.submit(apiCall, apiArgs, vm.errorMessages, vm.formStatus).then(function() {
            console.log("submit complete - routing to dashboard");
            m.route('/admin/dashboard');
          });
        };
      };
      return vm;
    })();
    sbAdmin.ctrl.botForm.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      vm.init();
    };
    return sbAdmin.ctrl.botForm.view = function() {
      var mEl;
      mEl = m("div", [
        m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-12"
          }, [
            m("h2", vm.resourceId() ? "Edit SwapBot " + (vm.name()) : "Create a New Swapbot"), m("div", {
              "class": "spacer1"
            }), sbAdmin.form.mForm({
              errors: vm.errorMessages,
              status: vm.formStatus
            }, {
              onsubmit: vm.save
            }, [
              sbAdmin.form.mAlerts(vm.errorMessages), sbAdmin.form.mFormField("Bot Name", {
                id: 'name',
                'placeholder': "Bot Name",
                required: true
              }, vm.name), sbAdmin.form.mFormField("Bot Description", {
                type: 'textarea',
                id: 'description',
                'placeholder': "Bot Description",
                required: true
              }, vm.description), m("hr"), m("h4", "Settings"), m("div", {
                "class": "spacer1"
              }), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-5"
                }, [
                  sbAdmin.form.mFormField("Confirmations", {
                    id: 'confirmations_required',
                    'placeholder': "2",
                    type: "number",
                    step: "1",
                    min: "1",
                    required: true
                  }, vm.confirmationsRequired)
                ]), m("div", {
                  "class": "col-md-5"
                }, [
                  sbAdmin.form.mFormField("Return Transaction Fee", {
                    id: 'return_fee',
                    'placeholder': "0.0001",
                    type: "number",
                    step: "any",
                    min: "0.00001",
                    required: true
                  }, vm.returnFee)
                ])
              ]), m("h5", "Blacklisted Addresses"), m("p", [m("small", "Blacklisted addresses do not trigger swaps and can be used to load the SwapBot.")]), vm.blacklistAddressesGroup.buildInputs(), m("hr"), m("h4", "Income Forwarding"), m("p", [m("small", "When the bot fills up to a certain amount, you may forward the funds to your own destination address.")]), vm.incomeRulesGroup.buildInputs(), m("hr"), m("h4", "Payment"), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-12"
                }, [
                  (vm.isNew ? sbAdmin.form.mFormField("Payment Plan", {
                    id: "payment_plan",
                    type: 'select',
                    options: sbAdmin.planutils.allPlanOptions()
                  }, vm.paymentPlan) : null), (!vm.isNew ? sbAdmin.form.mValueDisplay("Payment Plan", {
                    id: 'payment_plan'
                  }, sbAdmin.planutils.paymentPlanDesc(vm.paymentPlan())) : null)
                ])
              ]), m("hr"), vm.swaps().map(function(swap, offset) {
                return swapGroup(offset + 1, swap);
              }), m("div", {
                "class": "form-group"
              }, [
                m("a", {
                  "class": "",
                  href: '#add',
                  onclick: vm.addSwap
                }, [
                  m("span", {
                    "class": "glyphicon glyphicon-plus"
                  }, ''), m("span", {}, ' Add Another Swap')
                ])
              ]), m("div", {
                "class": "spacer1"
              }), sbAdmin.form.mSubmitBtn("Save Bot"), m("a[href='/admin/dashboard']", {
                "class": "btn btn-default pull-right",
                config: m.route
              }, "Return without Saving")
            ])
          ])
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  (function() {
    var buildPaymentTypeLabel, curryHandleAccountUpdatesMessage, updateAllAccountPayments, vm;
    sbAdmin.ctrl.botPaymentsView = {};
    curryHandleAccountUpdatesMessage = function(id) {
      return function(data) {
        updateAllAccountPayments(id);
      };
    };
    updateAllAccountPayments = function(id) {
      sbAdmin.api.getBotPaymentBalance(id).then(function(apiResponse) {
        vm.paymentBalance(apiResponse.balance);
      }, function(errorResponse) {
        vm.errorMessages(errorResponse.errors);
      });
      sbAdmin.api.getAllBotPayments(id).then(function(apiResponse) {
        apiResponse.reverse();
        vm.payments(apiResponse);
      }, function(errorResponse) {
        vm.errorMessages(errorResponse.errors);
      });
    };
    buildPaymentTypeLabel = function(isCredit) {
      if (isCredit) {
        return m('span', {
          "class": "label label-success"
        }, "Credit");
      } else {
        return m('span', {
          "class": "label label-warning"
        }, "Debit");
      }
    };
    vm = sbAdmin.ctrl.botPaymentsView.vm = (function() {
      vm = {};
      vm.init = function() {
        var id;
        vm.errorMessages = m.prop([]);
        vm.resourceId = m.prop('');
        vm.pusherClient = m.prop(null);
        vm.name = m.prop('');
        vm.address = m.prop('');
        vm.paymentAddress = m.prop('');
        vm.paymentPlan = m.prop('');
        vm.state = m.prop('');
        vm.paymentBalance = m.prop('');
        vm.payments = m.prop([]);
        id = m.route.param('id');
        sbAdmin.api.getBot(id).then(function(botData) {
          vm.resourceId(botData.id);
          vm.name(botData.name);
          vm.address(botData.address);
          vm.paymentAddress(botData.paymentAddress);
          vm.paymentPlan(botData.paymentPlan);
          vm.state(botData.state);
        }, function(errorResponse) {
          vm.errorMessages(errorResponse.errors);
        });
        vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChannel("swapbot_account_updates_" + id, curryHandleAccountUpdatesMessage(id)));
        updateAllAccountPayments(id);
      };
      return vm;
    })();
    sbAdmin.ctrl.botPaymentsView.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      this.onunload = function(e) {
        sbAdmin.pusherutils.closePusherChannel(vm.pusherClient());
      };
      vm.init();
    };
    sbAdmin.ctrl.botPaymentsView.view = function() {
      var mEl;
      mEl = m("div", [
        m("h2", "SwapBot " + (vm.name())), m("div", {
          "class": "spacer1"
        }), m("div", {
          "class": "bot-payments-view"
        }, [
          sbAdmin.form.mAlerts(vm.errorMessages), m("h3", "Payment Status"), m("div", {
            "class": "row"
          }, [
            m("div", {
              "class": "col-md-4"
            }, [
              sbAdmin.form.mValueDisplay("Payment Plan", {
                id: 'rate'
              }, sbAdmin.planutils.paymentPlanDesc(vm.paymentPlan()))
            ]), m("div", {
              "class": "col-md-6"
            }, [
              sbAdmin.form.mValueDisplay("Payment Address", {
                id: 'paymentAddress'
              }, vm.paymentAddress())
            ]), m("div", {
              "class": "col-md-2"
            }, [
              sbAdmin.form.mValueDisplay("Account Balance", {
                id: 'value'
              }, vm.paymentBalance() === '' ? '-' : sbAdmin.currencyutils.formatValue(vm.paymentBalance(), 'BTC'))
            ])
          ]), m("div", {
            "class": "bot-payments"
          }, [
            m("small", {
              "class": "pull-right"
            }, "newest first"), m("h3", "Payment History"), vm.payments().length === 0 ? m("div", {
              "class": "no-payments"
            }, "No Payments Yet") : null, m("ul", {
              "class": "list-unstyled striped-list bot-list payment-list"
            }, [
              vm.payments().map(function(botPaymentObj) {
                var dateObj;
                dateObj = window.moment(botPaymentObj.createdAt);
                return m("li", {
                  "class": "bot-list-entry payment"
                }, [
                  m("div", {
                    "class": "labelWrapper"
                  }, buildPaymentTypeLabel(botPaymentObj.isCredit)), m("span", {
                    "class": "date",
                    title: dateObj.format('MMMM Do YYYY, h:mm:ss a')
                  }, dateObj.format('MMM D h:mm a')), m("span", {
                    "class": "amount"
                  }, sbAdmin.currencyutils.satoshisToValue(botPaymentObj.amount)), m("span", {
                    "class": "msg"
                  }, botPaymentObj.msg)
                ]);
              })
            ])
          ]), m("div", {
            "class": "spacer2"
          }), m("a[href='/admin/view/bot/" + (vm.resourceId()) + "']", {
            "class": "btn btn-default",
            config: m.route
          }, "Return to Bot View")
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
    return sbAdmin.ctrl.botPaymentsView.UnloadEvent;
  })();

  (function() {
    var buildBalancesMElement, buildBlacklistAddressesGroup, buildIncomeRulesGroup, buildMLevel, curryHandleAccountUpdatesMessage, handleBotBalancesMessage, handleBotEventMessage, serializeSwaps, swapGroup, swapGroupRenderers, updateBotAccountBalance, vm;
    sbAdmin.ctrl.botView = {};
    swapGroupRenderers = {};
    swapGroupRenderers.rate = function(number, swap) {
      return m("div", {
        "class": "asset-group"
      }, [
        m("h4", "Swap #" + number), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mValueDisplay("Swap Type", {
              id: "swap_strategy_" + number
            }, sbAdmin.swaputils.strategyLabelByValue(swap.strategy()))
          ]), m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mValueDisplay("Receives Asset", {
              id: "swap_in_" + number
            }, swap["in"]())
          ]), m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mValueDisplay("Sends Asset", {
              id: "swap_out_" + number
            }, swap.out())
          ]), m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mValueDisplay("Rate", {
              type: "number",
              step: "any",
              min: "0",
              id: "swap_rate_" + number
            }, swap.rate())
          ])
        ])
      ]);
    };
    swapGroupRenderers.fixed = function(number, swap) {
      return m("div", {
        "class": "asset-group"
      }, [
        m("h4", "Swap #" + number), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-3"
          }, [
            sbAdmin.form.mValueDisplay("Swap Type", {
              id: "swap_strategy_" + number
            }, sbAdmin.swaputils.strategyLabelByValue(swap.strategy()))
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mValueDisplay("Receives Asset", {
              id: "swap_in_" + number
            }, swap["in"]())
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mValueDisplay("Receives Quantity", {
              id: "swap_in_qty_" + number
            }, swap.in_qty())
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mValueDisplay("Sends Asset", {
              id: "swap_out_" + number
            }, swap.out())
          ]), m("div", {
            "class": "col-md-2"
          }, [
            sbAdmin.form.mValueDisplay("Sends Quantity", {
              id: "swap_out_qty_" + number
            }, swap.out_qty())
          ])
        ])
      ]);
    };
    swapGroup = function(number, swapProp) {
      return swapGroupRenderers[swapProp().strategy()](number, swapProp());
    };
    serializeSwaps = function(swap) {
      var out;
      out = [];
      out.push(swap);
      return out;
    };
    buildIncomeRulesGroup = function() {
      return sbAdmin.formGroup.newGroup({
        id: 'incomerules',
        fields: [
          {
            name: 'asset'
          }, {
            name: 'minThreshold'
          }, {
            name: 'paymentAmount'
          }, {
            name: 'address'
          }
        ],
        buildItemRow: function(builder, number, item) {
          return [builder.header("Income Forwarding Rule #" + number), builder.row([builder.value("Asset Received", 'asset', {}, 3), builder.value("Trigger Threshold", 'minThreshold', {}), builder.value("Payment Amount", 'paymentAmount', {}), builder.value("Payment Address", 'address', {}, 4)])];
        },
        displayOnly: true
      });
    };
    buildBlacklistAddressesGroup = function() {
      return sbAdmin.formGroup.newGroup({
        id: 'blacklist',
        fields: [
          {
            name: 'address'
          }
        ],
        buildAllItemRows: function(items) {
          var addressList, item, offset, _i, _len;
          addressList = "";
          for (offset = _i = 0, _len = items.length; _i < _len; offset = ++_i) {
            item = items[offset];
            addressList += (offset > 0 ? ", " : "") + item.address();
          }
          return m("div", {
            "class": "item-group"
          }, [
            m("div", {
              "class": "row"
            }, m("div", {
              "class": "col-md-12 form-control-static"
            }, addressList))
          ]);
        },
        translateFieldToNumberedValues: 'address',
        useCompactNumberedLayout: true,
        displayOnly: true
      });
    };
    handleBotEventMessage = function(data) {
      var _ref;
      if (data != null ? (_ref = data.event) != null ? _ref.msg : void 0 : void 0) {
        vm.botEvents().unshift(data);
        m.redraw(true);
      }
    };
    handleBotBalancesMessage = function(data) {
      if (data != null) {
        vm.updateBalances(data);
        m.redraw(true);
      }
    };
    curryHandleAccountUpdatesMessage = function(id) {
      return function(data) {
        updateBotAccountBalance(id);
      };
    };
    updateBotAccountBalance = function(id) {
      return sbAdmin.api.getBotPaymentBalance(id).then(function(apiResponse) {
        vm.paymentBalance(apiResponse.balance);
      }, function(errorResponse) {
        vm.errorMessages(errorResponse.errors);
      });
    };
    buildMLevel = function(levelNumber) {
      switch (levelNumber) {
        case 100:
          return m('span', {
            "class": "label label-default debug"
          }, "Debug");
        case 200:
          return m('span', {
            "class": "label label-info info"
          }, "Info");
        case 250:
          return m('span', {
            "class": "label label-primary primary"
          }, "Notice");
        case 300:
          return m('span', {
            "class": "label label-warning warning"
          }, "Warning");
        case 400:
          return m('span', {
            "class": "label label-danger danger"
          }, "Error");
        case 500:
          return m('span', {
            "class": "label label-danger danger"
          }, "Critical");
        case 550:
          return m('span', {
            "class": "label label-danger danger"
          }, "Alert");
        case 600:
          return m('span', {
            "class": "label label-danger danger"
          }, "Emergency");
      }
      return m('span', {
        "class": "label label-danger danger"
      }, "Code " + levelNumber);
    };
    buildBalancesMElement = function(balances) {
      if (vm.balances().length > 0) {
        return m("table", {
          "class": "table table-condensed table-striped"
        }, [
          m("thead", {}, [
            m("tr", {}, [
              m('th', {
                style: {
                  width: '40%'
                }
              }, 'Asset'), m('th', {
                style: {
                  width: '60%'
                }
              }, 'Balance')
            ])
          ]), m("tbody", {}, [
            vm.balances().map(function(balance, index) {
              return m("tr", {}, [m('td', balance.asset), m('td', balance.val)]);
            })
          ])
        ]);
      } else {
        return m("div", {
          "class": "form-group"
        }, "No Balances Found");
      }
    };
    vm = sbAdmin.ctrl.botView.vm = (function() {
      var buildBalancesPropValue, buildSwapsPropValue;
      buildSwapsPropValue = function(swaps) {
        var out, swap, _i, _len;
        out = [];
        for (_i = 0, _len = swaps.length; _i < _len; _i++) {
          swap = swaps[_i];
          out.push(sbAdmin.swaputils.newSwapProp(swap));
        }
        return out;
      };
      buildBalancesPropValue = function(balances) {
        var asset, out, val;
        out = [];
        for (asset in balances) {
          val = balances[asset];
          out.push({
            asset: asset,
            val: val
          });
        }
        return out;
      };
      vm = {};
      vm.updateBalances = function(newBalances) {
        vm.balances(buildBalancesPropValue(newBalances));
      };
      vm.toggleDebugView = function(e) {
        e.preventDefault();
        vm.showDebug = !vm.showDebug;
      };
      vm.init = function() {
        var id;
        vm.errorMessages = m.prop([]);
        vm.formStatus = m.prop('active');
        vm.resourceId = m.prop('new');
        vm.pusherClient = m.prop(null);
        vm.botEvents = m.prop([]);
        vm.showDebug = false;
        vm.name = m.prop('');
        vm.description = m.prop('');
        vm.address = m.prop('');
        vm.paymentAddress = m.prop('');
        vm.paymentPlan = m.prop('');
        vm.state = m.prop('');
        vm.swaps = m.prop(buildSwapsPropValue([]));
        vm.balances = m.prop(buildBalancesPropValue([]));
        vm.confirmationsRequired = m.prop('');
        vm.returnFee = m.prop('');
        vm.paymentBalance = m.prop('');
        vm.incomeRulesGroup = buildIncomeRulesGroup();
        vm.blacklistAddressesGroup = buildBlacklistAddressesGroup();
        id = m.route.param('id');
        sbAdmin.api.getBot(id).then(function(botData) {
          vm.resourceId(botData.id);
          vm.name(botData.name);
          vm.address(botData.address);
          vm.paymentAddress(botData.paymentAddress);
          vm.paymentPlan(botData.paymentPlan);
          vm.state(botData.state);
          vm.description(botData.description);
          vm.swaps(buildSwapsPropValue(botData.swaps));
          vm.balances(buildBalancesPropValue(botData.balances));
          vm.confirmationsRequired(botData.confirmationsRequired);
          vm.returnFee(botData.returnFee);
          vm.incomeRulesGroup.unserialize(botData.incomeRules);
          vm.blacklistAddressesGroup.unserialize(botData.blacklistAddresses);
        }, function(errorResponse) {
          vm.errorMessages(errorResponse.errors);
        });
        sbAdmin.api.getBotEvents(id).then(function(apiResponse) {
          vm.botEvents(apiResponse);
        }, function(errorResponse) {
          vm.errorMessages(errorResponse.errors);
        });
        updateBotAccountBalance(id);
        vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChannel("swapbot_events_" + id, handleBotEventMessage));
        vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChannel("swapbot_balances_" + id, handleBotBalancesMessage));
        vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChannel("swapbot_account_updates_" + id, curryHandleAccountUpdatesMessage(id)));
        sbAdmin.api.refreshBalances(id).then(function(apiResponse) {}, function(errorResponse) {
          console.log("ERROR: " + errorResponse.msg);
        });
      };
      return vm;
    })();
    sbAdmin.ctrl.botView.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      this.onunload = function(e) {
        sbAdmin.pusherutils.closePusherChannel(vm.pusherClient());
      };
      vm.init();
    };
    sbAdmin.ctrl.botView.view = function() {
      var mEl;
      mEl = m("div", [
        m("h2", "SwapBot " + (vm.name())), m("div", {
          "class": "spacer1"
        }), m("div", {
          "class": "bot-status"
        }, [sbAdmin.stateutils.buildStateDisplay(sbAdmin.stateutils.buildStateDetails(vm.state(), vm.paymentPlan(), vm.paymentAddress(), vm.address()))]), m("div", {
          "class": "spacer1"
        }), m("div", {
          "class": "bot-view"
        }, [
          sbAdmin.form.mAlerts(vm.errorMessages), m("div", {
            "class": "row"
          }, [
            m("div", {
              "class": "col-md-8"
            }, [
              m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-3"
                }, [
                  sbAdmin.form.mValueDisplay("Bot Name", {
                    id: 'name'
                  }, vm.name())
                ]), m("div", {
                  "class": "col-md-6"
                }, [
                  sbAdmin.form.mValueDisplay("Bot Address", {
                    id: 'address'
                  }, vm.address() ? vm.address() : m("span", {
                    "class": 'no'
                  }, "[ none ]"))
                ]), m("div", {
                  "class": "col-md-3"
                }, [
                  sbAdmin.form.mValueDisplay("Status", {
                    id: 'status'
                  }, sbAdmin.stateutils.buildStateSpan(vm.state()))
                ])
              ]), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-4"
                }, [
                  sbAdmin.form.mValueDisplay("Return Transaction Fee", {
                    id: 'return_fee'
                  }, vm.returnFee() + ' BTC')
                ]), m("div", {
                  "class": "col-md-4"
                }, [
                  sbAdmin.form.mValueDisplay("Confirmations", {
                    id: 'confirmations_required'
                  }, vm.confirmationsRequired())
                ])
              ]), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-12"
                }, [
                  sbAdmin.form.mValueDisplay("Bot Description", {
                    id: 'description'
                  }, vm.description())
                ])
              ])
            ]), m("div", {
              "class": "col-md-4"
            }, [
              sbAdmin.form.mValueDisplay("Balances", {
                id: 'balances'
              }, buildBalancesMElement(vm.balances()))
            ])
          ]), m("hr"), vm.swaps().map(function(swap, offset) {
            return swapGroup(offset + 1, swap);
          }), m("hr"), m("h4", "Blacklisted Addresses"), vm.blacklistAddressesGroup.buildValues(), m("div", {
            "class": "spacer1"
          }), m("hr"), vm.incomeRulesGroup.buildValues(), m("hr"), m("div", {
            "class": "bot-events"
          }, [
            m("div", {
              "class": "pulse-spinner pull-right"
            }, [
              m("div", {
                "class": "rect1"
              }), m("div", {
                "class": "rect2"
              }), m("div", {
                "class": "rect3"
              }), m("div", {
                "class": "rect4"
              }), m("div", {
                "class": "rect5"
              })
            ]), m("h3", "Events"), vm.botEvents().length === 0 ? m("div", {
              "class": "no-events"
            }, "No Events Yet") : null, m("ul", {
              "class": "list-unstyled striped-list bot-list event-list"
            }, [
              vm.botEvents().map(function(botEventObj) {
                var dateObj, _ref;
                if (!vm.showDebug && botEventObj.level <= 100) {
                  return;
                }
                dateObj = window.moment(botEventObj.createdAt);
                return m("li", {
                  "class": "bot-list-entry event"
                }, [
                  m("div", {
                    "class": "labelWrapper"
                  }, buildMLevel(botEventObj.level)), m("span", {
                    "class": "date",
                    title: dateObj.format('MMMM Do YYYY, h:mm:ss a')
                  }, dateObj.format('MMM D h:mm a')), m("span", {
                    "class": "msg"
                  }, (_ref = botEventObj.event) != null ? _ref.msg : void 0)
                ]);
              })
            ]), m("div", {
              "class": "pull-right"
            }, [
              m("a[href='#show-debug']", {
                onclick: vm.toggleDebugView,
                "class": "btn " + (vm.showDebug ? 'btn-warning' : 'btn-default') + " btn-xs",
                style: {
                  "margin-right": "16px"
                }
              }, [vm.showDebug ? "Hide Debug" : "Show Debug"])
            ])
          ]), m("div", {
            "class": "spacer1"
          }), m("hr"), m("div", {
            "class": "bot-payments"
          }, [
            m("h3", "Payment Status"), m("div", {
              "class": "row"
            }, [
              m("div", {
                "class": "col-md-4"
              }, [
                sbAdmin.form.mValueDisplay("Payment Plan", {
                  id: 'rate'
                }, sbAdmin.planutils.paymentPlanDesc(vm.paymentPlan()))
              ]), m("div", {
                "class": "col-md-6"
              }, [
                sbAdmin.form.mValueDisplay("Payment Address", {
                  id: 'paymentAddress'
                }, vm.paymentAddress())
              ]), m("div", {
                "class": "col-md-2"
              }, [
                sbAdmin.form.mValueDisplay("Account Balance", {
                  id: 'value'
                }, vm.paymentBalance() === '' ? '-' : vm.paymentBalance() + ' BTC')
              ])
            ])
          ]), m("a[href='/admin/payments/bot/" + (vm.resourceId()) + "']", {
            "class": "btn btn-info",
            config: m.route
          }, "View Payment Details"), m("div", {
            "class": "spacer1"
          }), m("hr"), m("div", {
            "class": "spacer2"
          }), m("a[href='/admin/edit/bot/" + (vm.resourceId()) + "']", {
            "class": "btn btn-success",
            config: m.route
          }, "Edit This Bot"), m("a[href='/admin/dashboard']", {
            "class": "btn btn-default pull-right",
            config: m.route
          }, "Back to Dashboard")
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
    return sbAdmin.ctrl.botView.UnloadEvent;
  })();

  (function() {
    var listSwapbots, vm;
    sbAdmin.ctrl.dashboard = {};
    listSwapbots = function() {
      return sbAdmin.api.getBots().then(function(botsList) {
        return m.prop(botsList);
      });
    };
    vm = sbAdmin.ctrl.dashboard.vm = (function() {
      vm = {};
      vm.init = function() {
        vm.user = m.prop(sbAdmin.auth.getUser());
        vm.bots = m.prop([]);
        sbAdmin.api.getAllBots().then(function(botsList) {
          vm.bots(botsList);
        });
      };
      return vm;
    })();
    sbAdmin.ctrl.dashboard.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      vm.init();
    };
    return sbAdmin.ctrl.dashboard.view = function() {
      var mEl;
      mEl = m("div", [
        m("h2", "Welcome, " + (vm.user().name)), m("div", {
          "class": "spacer1"
        }), m("p", {
          "class": ""
        }, "Here is a list of your Swapbots:"), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-6 col-lg-4"
          }, [
            m("ul", {
              "class": "list-unstyled striped-list bot-list"
            }, [
              vm.bots().map(function(bot) {
                return m("li", {}, [
                  m("div", {}, [
                    m("a[href='/admin/view/bot/" + bot.id + "']", {
                      "class": "",
                      config: m.route
                    }, "" + bot.name), " ", m("a[href='/admin/edit/bot/" + bot.id + "']", {
                      "class": "dashboard-edit-link pull-right",
                      config: m.route
                    }, [
                      m("span", {
                        "class": "glyphicon glyphicon-edit",
                        title: "Edit Swapbot " + bot.name
                      }, ''), " Edit"
                    ])
                  ])
                ]);
              })
            ])
          ])
        ]), m("div", {
          "class": "spacer1"
        }), m("a[href='/admin/edit/bot/new']", {
          "class": "btn btn-primary",
          config: m.route
        }, "Create a new Swapbot")
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  (function() {
    var vm;
    sbAdmin.ctrl.login = {};
    vm = sbAdmin.ctrl.login.vm = (function() {
      vm = {};
      vm.init = function() {
        vm.apiToken = m.prop('');
        vm.apiSecretKey = m.prop('');
        vm.errorMessage = m.prop('');
        vm.login = function(e) {
          e.preventDefault();
          vm.errorMessage('');
          sbAdmin.auth.login(vm.apiToken(), vm.apiSecretKey()).then(function() {
            return m.route('/admin/dashboard');
          }, function(error) {
            vm.errorMessage(error.message);
          });
        };
      };
      return vm;
    })();
    sbAdmin.ctrl.login.controller = function() {
      vm.init();
    };
    return sbAdmin.ctrl.login.view = function() {
      var mEl;
      mEl = m("div", [
        m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-12"
          }, [
            m("h2", "Please Login to Continue"), m("p", "Enter your API credentials below to save them in your browser."), m("div", {
              "class": "spacer1"
            }), m("form", {
              onsubmit: vm.login
            }, [
              (function() {
                if (vm.errorMessage() === '') {
                  return null;
                }
                return m("div", {
                  "class": "alert alert-danger",
                  role: "alert"
                }, [m("strong", "An error occurred. "), m('span', vm.errorMessage())]);
              })(), m("div", {
                "class": "form-group"
              }, [
                m("label", {
                  "for": 'apiToken'
                }, "API Token"), m("input", {
                  id: 'apiToken',
                  "class": 'form-control',
                  placeholder: "Your API Token",
                  required: true,
                  onchange: m.withAttr("value", vm.apiToken),
                  value: vm.apiToken()
                })
              ]), m("div", {
                "class": "form-group"
              }, [
                m("label", {
                  "for": 'apiSecretKey'
                }, "API Secret Key"), m("input", {
                  type: 'password',
                  id: 'apiSecretKey',
                  "class": 'form-control',
                  placeholder: "Your API Secret Key",
                  required: true,
                  onchange: m.withAttr("value", vm.apiSecretKey),
                  value: vm.apiSecretKey()
                })
              ]), m("div", {
                "class": "spacer1"
              }), m("button", {
                type: 'submit',
                "class": 'btn btn-primary'
              }, "Save Credentials")
            ])
          ])
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  (function() {
    sbAdmin.ctrl.logout = {};
    sbAdmin.ctrl.logout.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      sbAdmin.auth.logout();
    };
    return sbAdmin.ctrl.logout.view = function() {
      var mEl;
      mEl = m("div", [
        m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-12"
          }, [
            m("h2", "Logged Out"), m("p", "The API credentials have been cleared from your browser."), m("div", {
              "class": "spacer1"
            }), m("a[href='/admin/login']", {
              config: m.route
            }, "Return to Login")
          ])
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  (function() {
    var formatPrivileges, vm;
    sbAdmin.ctrl.userForm = {};
    formatPrivileges = function(privileges) {
      var out, privilege, set;
      out = (function() {
        var _results;
        _results = [];
        for (privilege in privileges) {
          set = privileges[privilege];
          _results.push(privilege);
        }
        return _results;
      })();
      if (out.length) {
        return out.join(", ");
      }
      return "No Privileges";
    };
    vm = sbAdmin.ctrl.userForm.vm = (function() {
      vm = {};
      vm.init = function() {
        var id;
        vm.errorMessages = m.prop([]);
        vm.formStatus = m.prop('active');
        vm.resourceId = m.prop('');
        vm.name = m.prop('');
        vm.email = m.prop('');
        vm.apitoken = m.prop('');
        vm.apisecretkey = m.prop('');
        vm.privileges = m.prop('');
        id = m.route.param('id');
        if (id !== 'new') {
          sbAdmin.api.getUser(id).then(function(userData) {
            vm.resourceId(userData.id);
            vm.name(userData.name);
            vm.email(userData.email);
            vm.apitoken(userData.apitoken);
            vm.apisecretkey(userData.apisecretkey);
            vm.privileges(userData.privileges);
          }, function(errorResponse) {
            vm.errorMessages(errorResponse.errors);
          });
        }
        vm.save = function(e) {
          var apiArgs, apiCall, attributes;
          e.preventDefault();
          attributes = {
            name: vm.name(),
            email: vm.email()
          };
          if (vm.resourceId().length > 0) {
            apiCall = sbAdmin.api.updateUser;
            apiArgs = [vm.resourceId(), attributes];
          } else {
            apiCall = sbAdmin.api.newUser;
            apiArgs = [attributes];
          }
          return sbAdmin.form.submit(apiCall, apiArgs, vm.errorMessages, vm.formStatus).then(function() {
            m.route('/admin/users');
          });
        };
      };
      return vm;
    })();
    sbAdmin.ctrl.userForm.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      vm.init();
    };
    return sbAdmin.ctrl.userForm.view = function() {
      var mEl;
      mEl = m("div", [
        m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-12"
          }, [
            m("h2", vm.resourceId() ? "Edit User " + (vm.name()) : "Create a New User"), m("div", {
              "class": "spacer1"
            }), sbAdmin.form.mForm({
              errors: vm.errorMessages,
              status: vm.formStatus
            }, {
              onsubmit: vm.save
            }, [
              sbAdmin.form.mAlerts(vm.errorMessages), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-5"
                }, [
                  sbAdmin.form.mFormField("Name", {
                    id: 'name',
                    'placeholder': "User Name",
                    required: true
                  }, vm.name)
                ]), m("div", {
                  "class": "col-md-7"
                }, [
                  sbAdmin.form.mFormField("Email", {
                    type: 'email',
                    id: 'email',
                    'placeholder': "User Email",
                    required: true
                  }, vm.email)
                ])
              ]), m("hr"), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-4"
                }, [
                  sbAdmin.form.mValueDisplay("API Token", {
                    id: "apitoken"
                  }, vm.apitoken())
                ]), m("div", {
                  "class": "col-md-8"
                }, [
                  sbAdmin.form.mValueDisplay("API Secret Key", {
                    id: "apisecretkey"
                  }, vm.apisecretkey())
                ])
              ]), m("div", {
                "class": "row"
              }, [
                m("div", {
                  "class": "col-md-6"
                }, [
                  sbAdmin.form.mValueDisplay("privileges", {
                    id: "apitoken"
                  }, formatPrivileges(vm.privileges()))
                ])
              ]), m("div", {
                "class": "spacer1"
              }), sbAdmin.form.mSubmitBtn("Save User"), m("a[href='/admin/users']", {
                "class": "btn btn-default pull-right",
                config: m.route
              }, "Return without Saving")
            ])
          ])
        ])
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  (function() {
    var vm;
    sbAdmin.ctrl.usersView = {};
    vm = sbAdmin.ctrl.usersView.vm = (function() {
      vm = {};
      vm.init = function() {
        vm.users = m.prop([]);
        sbAdmin.api.getAllUsers().then(function(usersList) {
          vm.users(usersList);
        });
      };
      return vm;
    })();
    sbAdmin.ctrl.usersView.controller = function() {
      sbAdmin.auth.redirectIfNotLoggedIn();
      vm.init();
    };
    return sbAdmin.ctrl.usersView.view = function() {
      var mEl;
      mEl = m("div", [
        m("h2", "API Users"), m("div", {
          "class": "spacer1"
        }), m("div", {
          "class": "row"
        }, [
          m("div", {
            "class": "col-md-6 col-lg-4"
          }, [
            m("ul", {
              "class": "list-unstyled striped-list user-list"
            }, [
              vm.users().map(function(user) {
                return m("li", {}, [
                  m("div", {}, [
                    m("a[href='/admin/edit/user/" + user.id + "']", {
                      "class": "",
                      config: m.route
                    }, "" + user.name), " ", m("a[href='/admin/edit/user/" + user.id + "']", {
                      "class": "usersView-edit-link pull-right",
                      config: m.route
                    }, [
                      m("span", {
                        "class": "glyphicon glyphicon-edit",
                        title: "Edit User " + user.name
                      }, ''), " Edit"
                    ])
                  ])
                ]);
              })
            ])
          ])
        ]), m("div", {
          "class": "spacer1"
        }), m("a[href='/admin/edit/user/new']", {
          "class": "btn btn-primary",
          config: m.route
        }, "Create a new user")
      ]);
      return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)];
    };
  })();

  m.route.mode = "pathname";

  m.route(document.getElementById('admin'), "/admin/dashboard", {
    "/admin/login": sbAdmin.ctrl.login,
    "/admin/logout": sbAdmin.ctrl.logout,
    "/admin/dashboard": sbAdmin.ctrl.dashboard,
    "/admin/edit/bot/:id": sbAdmin.ctrl.botForm,
    "/admin/view/bot/:id": sbAdmin.ctrl.botView,
    "/admin/payments/bot/:id": sbAdmin.ctrl.botPaymentsView,
    "/admin/users": sbAdmin.ctrl.usersView,
    "/admin/edit/user/:id": sbAdmin.ctrl.userForm
  });

}).call(this);
