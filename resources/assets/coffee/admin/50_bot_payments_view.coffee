do ()->

    sbAdmin.ctrl.botPaymentsView = {}


    # ### helpers #####################################


    curryHandleAccountUpdatesMessage = (id)->
        return (data)->
            updateAllAccountPayments(id)
            return

    updateAllAccountPayments = (id)->
        sbAdmin.api.getBotPaymentBalances(id).then(
            (apiResponse)->
                paymentBalances = []
                for asset, val of apiResponse.balances
                    paymentBalances.push({asset: asset, val: val})
                vm.paymentBalances(paymentBalances)
                return
            , (errorResponse)->
                vm.errorMessages(errorResponse.errors)
                return
        )

        sbAdmin.api.getAllBotPayments(id).then(
            (apiResponse)->
                apiResponse.reverse()
                vm.payments(apiResponse)
                return
            , (errorResponse)->
                vm.errorMessages(errorResponse.errors)
                return
        )

        return

    buildPaymentTypeLabel = (isCredit)->
        if isCredit
            return m('span', {class: "label label-success"}, "Credit")
        else
            return m('span', {class: "label label-warning"}, "Debit")


    # ################################################

    vm = sbAdmin.ctrl.botPaymentsView.vm = do ()->

        vm = {}


        vm.init = ()->
            # view status
            vm.errorMessages = m.prop([])
            vm.resourceId = m.prop('')
            vm.pusherClient = m.prop(null)
            vm.allPlansData = m.prop(null)

            # fields
            vm.name = m.prop('')
            vm.address = m.prop('')
            vm.paymentAddress = m.prop('')
            vm.paymentPlan = m.prop('')
            vm.state = m.prop('')
            vm.paymentBalances = m.prop('')
            vm.payments = m.prop([])

            # if there is an id, then load it from the api
            id = m.route.param('id')
            # load the bot info from the api
            sbAdmin.api.getBot(id).then(
                (botData)->
                    # console.log "botData", botData
                    vm.resourceId(botData.id)

                    vm.name(botData.name)
                    vm.address(botData.address)
                    vm.paymentAddress(botData.paymentAddress)
                    vm.paymentPlan(botData.paymentPlan)
                    vm.state(botData.state)

                    return
                , (errorResponse)->
                    vm.errorMessages(errorResponse.errors)
                    return
            )

            # and the plan options
            sbAdmin.api.getAllPlansData().then(
                (apiResponse)->
                    vm.allPlansData(apiResponse)
                    return
                , (errorResponse)->
                    vm.errorMessages(errorResponse.errors)
                    return
            )


            vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChanel("swapbot_account_updates_#{id}", curryHandleAccountUpdatesMessage(id)))
            updateAllAccountPayments(id)

            return
        return vm

    sbAdmin.ctrl.botPaymentsView.controller = ()->
        # require login
        sbAdmin.auth.redirectIfNotLoggedIn()

        # bind unload event
        this.onunload = (e)->
            # console.log "unload bot view vm.pusherClient()=",vm.pusherClient()
            sbAdmin.pusherutils.closePusherChanel(vm.pusherClient())
            return

        vm.init()
        return


    sbAdmin.ctrl.botPaymentsView.view = ()->

        # console.log "vm.balances()=",vm.balances()
        # console.log "vm.payments().length=",vm.payments().length

        mEl = m("div", [
                m("h2", "SwapBot #{vm.name()}"),

                m("div", {class: "spacer1"}),

                m("div", {class: "bot-payments-view"}, [
                    sbAdmin.form.mAlerts(vm.errorMessages),

                    m("h3", "Payment Status"),
                    m("div", { class: "row"}, [
                            m("div", {class: "col-md-4"}, [
                                sbAdmin.form.mValueDisplay("Payment Plan", {id: 'rate',  }, sbAdmin.planutils.paymentPlanDesc(vm.paymentPlan(), vm.allPlansData())),
                            ]),
                            m("div", {class: "col-md-5"}, [
                                sbAdmin.form.mValueDisplay("Payment Address", {id: 'paymentAddress',  }, vm.paymentAddress()),
                            ]),
                            m("div", {class: "col-md-3"}, [
                                sbAdmin.form.mValueDisplay("Account Balances", {id: 'balances',  }, sbAdmin.utils.buildBalancesMElement(vm.paymentBalances())),
                            ]),
                    ]),


                    m("div", {class: "bot-payments"}, [
                        m("small", {class: "pull-right"}, "newest first"),
                        m("h3", "Payment History"),
                        if vm.payments().length == 0 then m("div", {class:"no-payments", }, "No Payments Yet") else null,
                        m("ul", {class: "list-unstyled striped-list bot-list payment-list"}, [
                            vm.payments().map (botPaymentObj)->
                                dateObj = window.moment(botPaymentObj.createdAt)
                                return m("li", {class: "bot-list-entry payment"}, [
                                    m("div", {class: "labelWrapper"}, buildPaymentTypeLabel(botPaymentObj.isCredit)),
                                    m("span", {class: "date", title: dateObj.format('MMMM Do YYYY, h:mm:ss a')}, dateObj.format('MMM D h:mm a')),
                                    m("span", {class: "amount"}, sbAdmin.currencyutils.satoshisToValue(botPaymentObj.amount, botPaymentObj.asset)),
                                    m("span", {class: "msg"}, botPaymentObj.msg),
                                ])
                        ]),
                    ]),



                    m("div", {class: "spacer2"}),

                    m("a[href='/admin/view/bot/#{vm.resourceId()}']", {class: "btn btn-default", config: m.route}, "Return to Bot View"),
                    

                ]),


        ])
        return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)]

    sbAdmin.ctrl.botPaymentsView.UnloadEvent