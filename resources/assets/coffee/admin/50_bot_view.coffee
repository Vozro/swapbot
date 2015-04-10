do ()->

    sbAdmin.ctrl.botView = {}

    # ### helpers #####################################
    swapGroupRenderers = {}

    swapGroupRenderers.rate = (number, swap)->
        return m("div", {class: "asset-group"}, [
            m("h4", "Swap ##{number}"),
            m("div", { class: "row"}, [
                m("div", {class: "col-md-3"}, [
                    sbAdmin.form.mValueDisplay("Swap Type", {id: "swap_strategy_#{number}",}, sbAdmin.swaputils.strategyLabelByValue(swap.strategy())),
                ]),
                m("div", {class: "col-md-3"}, [
                    sbAdmin.form.mValueDisplay("Receives Asset", {id: "swap_in_#{number}", }, swap.in()),
                ]),
                m("div", {class: "col-md-3"}, [
                    sbAdmin.form.mValueDisplay("Sends Asset", {id: "swap_out_#{number}", }, swap.out()),
                ]),
                m("div", {class: "col-md-3"}, [
                    sbAdmin.form.mValueDisplay("Rate", {type: "number", step: "any", min: "0", id: "swap_rate_#{number}", }, swap.rate()),
                ]),
            ]),
        ])

    swapGroupRenderers.fixed = (number, swap)->
        return m("div", {class: "asset-group"}, [
            m("h4", "Swap ##{number}"),
            m("div", { class: "row"}, [
                m("div", {class: "col-md-3"}, [
                    sbAdmin.form.mValueDisplay("Swap Type", {id: "swap_strategy_#{number}",}, sbAdmin.swaputils.strategyLabelByValue(swap.strategy())),
                ]),
                m("div", {class: "col-md-2"}, [
                    sbAdmin.form.mValueDisplay("Receives Asset", {id: "swap_in_#{number}", }, swap.in()),
                ]),
                m("div", {class: "col-md-2"}, [
                    sbAdmin.form.mValueDisplay("Receives Quantity", {id: "swap_in_qty_#{number}", }, swap.in_qty()),
                ]),
                m("div", {class: "col-md-2"}, [
                    sbAdmin.form.mValueDisplay("Sends Asset", {id: "swap_out_#{number}", }, swap.out()),
                ]),
                m("div", {class: "col-md-2"}, [
                    sbAdmin.form.mValueDisplay("Sends Quantity", {id: "swap_out_qty_#{number}", }, swap.out_qty()),
                ]),
            ]),
        ])

    swapGroup = (number, swapProp)->
        return swapGroupRenderers[swapProp().strategy()](number, swapProp())

    serializeSwaps = (swap)->
        out = []
        out.push(swap)
        return out

    # ################################################

    buildIncomeRulesGroup = ()->
        return sbAdmin.formGroup.newGroup({
            id: 'incomerules'
            fields: [
                {name: 'asset', }
                {name: 'minThreshold', }
                {name: 'paymentAmount', }
                {name: 'address', }
            ]
            buildItemRow: (builder, number, item)->
                return [
                    builder.header("Income Forwarding Rule ##{number}"),
                    builder.row([
                        builder.value("Asset Received", 'asset', {}, 3), 
                        builder.value("Trigger Threshold", 'minThreshold', {}), 
                        builder.value("Payment Amount", 'paymentAmount', {}), 
                        builder.value("Payment Address", 'address', {}, 4), 
                    ]),
                ]
            displayOnly: true
        })

    # ################################################

    buildBlacklistAddressesGroup = ()->
        return sbAdmin.formGroup.newGroup({
            id: 'blacklist'
            fields: [
                {name: 'address', }
            ]
            buildAllItemRows: (items)->
                addressList = ""
                for item, offset in items
                    addressList += (if offset > 0 then ", " else "")+item.address()

                return m("div", {class: "item-group"}, [
                    m("div", { class: "row"}, m("div", {class: "col-md-12 form-control-static"}, addressList)),
                ])

                
            translateFieldToNumberedValues: 'address'
            useCompactNumberedLayout: true
            displayOnly: true
        })

    # ################################################

    botPublicAddress = (vm)->
        return swapbot.addressUtils.publicBotAddress(vm.username(), vm.resourceId(), window.location)

    poupupBotAddress = (vm)->
        return swapbot.addressUtils.poupupBotAddress(vm.username(), vm.resourceId(), window.location)

    # ################################################


    handleBotEventMessage = (data)->
        # console.log "pusher received:", data
        # console.log "msg:", data?.event?.msg
        if data?.event?.msg
            vm.botEvents().unshift(data)
            # this is outside of mithril, so we must force a redraw
            m.redraw(true)
        return

    handleBotBalancesMessage = (data)->
        # console.log "bot balances:",data
        if data?
            vm.updateBalances(data)
            # this is outside of mithril, so we must force a redraw
            m.redraw(true)
        return

    curryHandleAccountUpdatesMessage = (id)->
        return (data)->
            updateBotAccountBalance(id)
            return

    updateBotAccountBalance = (id)->
        sbAdmin.api.getBotPaymentBalance(id).then(
            (apiResponse)->
                vm.paymentBalance(apiResponse.balance)
                return
            , (errorResponse)->
                vm.errorMessages(errorResponse.errors)
                return
        )


    buildMLevel = (levelNumber)->
        switch levelNumber
            when 100 then return m('span', {class: "label label-default debug"}, "Debug")
            when 200 then return m('span', {class: "label label-info info"}, "Info")
            when 250 then return m('span', {class: "label label-primary primary"}, "Notice")
            when 300 then return m('span', {class: "label label-warning warning"}, "Warning")
            when 400 then return m('span', {class: "label label-danger danger"}, "Error")
            when 500 then return m('span', {class: "label label-danger danger"}, "Critical")
            when 550 then return m('span', {class: "label label-danger danger"}, "Alert")
            when 600 then return m('span', {class: "label label-danger danger"}, "Emergency")
        return m('span', {class: "label label-danger danger"}, "Code #{levelNumber}")

    buildBalancesMElement = (balances)->
        if vm.balances().length > 0
            return m("table", {class: "table table-condensed table-striped"}, [
                m("thead", {}, [
                    m("tr", {}, [
                        m('th', {style: {width:'40%'}}, 'Asset'),
                        m('th', {style: {width:'60%'}}, 'Balance'),
                    ]),
                ]),
                m("tbody", {}, [
                    vm.balances().map (balance, index)->
                        return m("tr", {}, [
                            m('td', balance.asset),
                            m('td', balance.val),
                        ])
                ]),
            ])
        else
            return m("div", {class: "form-group"}, "No Balances Found")




    # ################################################


    # ################################################

    vm = sbAdmin.ctrl.botView.vm = do ()->
        buildSwapsPropValue = (swaps)->
            out = []
            for swap in swaps
                out.push(sbAdmin.swaputils.newSwapProp(swap))
            return out


        buildBalancesPropValue = (balances)->
            out = []
            for asset, val of balances
                out.push({
                    asset: asset
                    val: val
                })
            # console.log "buildBalancesPropValue out=",out
            return out

        vm = {}

        vm.updateBalances = (newBalances)->
            vm.balances(buildBalancesPropValue(newBalances))
            return

        vm.toggleDebugView = (e)->
            e.preventDefault()
            vm.showDebug = !vm.showDebug
            return


        vm.init = ()->
            # view status
            vm.errorMessages = m.prop([])
            vm.formStatus = m.prop('active')
            vm.resourceId = m.prop('new')
            vm.pusherClient = m.prop(null)
            vm.botEvents = m.prop([])
            vm.showDebug = false

            # fields
            vm.name = m.prop('')
            vm.description = m.prop('')
            vm.hash = m.prop('')
            vm.username = m.prop('')
            vm.address = m.prop('')
            vm.paymentAddress = m.prop('')
            vm.paymentPlan = m.prop('')
            vm.state = m.prop('')
            vm.swaps = m.prop(buildSwapsPropValue([]))
            vm.balances = m.prop(buildBalancesPropValue([]))
            vm.confirmationsRequired = m.prop('')
            vm.returnFee = m.prop('')
            vm.paymentBalance = m.prop('')

            vm.incomeRulesGroup = buildIncomeRulesGroup()
            vm.blacklistAddressesGroup = buildBlacklistAddressesGroup()

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
                    vm.description(botData.description)
                    vm.hash(botData.hash)
                    vm.username(botData.username)
                    vm.swaps(buildSwapsPropValue(botData.swaps))
                    vm.balances(buildBalancesPropValue(botData.balances))
                    vm.confirmationsRequired(botData.confirmationsRequired)
                    vm.returnFee(botData.returnFee)

                    vm.incomeRulesGroup.unserialize(botData.incomeRules)
                    vm.blacklistAddressesGroup.unserialize(botData.blacklistAddresses)

                    return
                , (errorResponse)->
                    vm.errorMessages(errorResponse.errors)
                    return
            )

            # also get the bot events
            sbAdmin.api.getBotEvents(id).then(
                (apiResponse)->
                    vm.botEvents(apiResponse)
                    return
                , (errorResponse)->
                    vm.errorMessages(errorResponse.errors)
                    return
            )

            # and get the bot balance
            updateBotAccountBalance(id)

            vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChanel("swapbot_events_#{id}", handleBotEventMessage))
            vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChanel("swapbot_balances_#{id}", handleBotBalancesMessage))
            vm.pusherClient(sbAdmin.pusherutils.subscribeToPusherChanel("swapbot_account_updates_#{id}", curryHandleAccountUpdatesMessage(id)))
            # console.log "vm.pusherClient=",vm.pusherClient()

            # refresh balances are not needed
            # # and send a balance refresh on each reload
            # sbAdmin.api.refreshBalances(id).then(
            #     (apiResponse)->
            #         return
            #     , (errorResponse)->
            #         console.log "ERROR: "+errorResponse.msg
            #         return
            # )

            return
        return vm

    sbAdmin.ctrl.botView.controller = ()->
        # require login
        sbAdmin.auth.redirectIfNotLoggedIn()

        # bind unload event
        this.onunload = (e)->
            # console.log "unload bot view vm.pusherClient()=",vm.pusherClient()
            sbAdmin.pusherutils.closePusherChanel(vm.pusherClient())
            return

        vm.init()
        return


    sbAdmin.ctrl.botView.view = ()->

        # console.log "vm.balances()=",vm.balances()

        mEl = m("div", [


                m("div", { class: "row"}, [
                    m("div", {class: "col-md-10"}, [
                        m("h2", "SwapBot #{vm.name()}"),
                    ]),
                    m("div", {class: "col-md-2 text-right"}, [
                        if vm.hash().length then m("img", {class: 'mediumRoboHead', src: "http://robohash.org/#{vm.hash()}.png?set=set3"}) else null,
                    ]),
                ]),


                

                m("div", {class: "spacer1"}),

                m("div", {class: "bot-status"}, [
                    sbAdmin.stateutils.buildStateDisplay(sbAdmin.stateutils.buildStateDetails(vm.state(), vm.paymentPlan(), vm.paymentAddress(), vm.address()))
                ]),

                m("div", {class: "spacer1"}),

                m("div", {class: "bot-view"}, [
                    sbAdmin.form.mAlerts(vm.errorMessages),

                    m("div", { class: "row"}, [

                        m("div", {class: "col-md-8"}, [

                            m("div", { class: "row"}, [
                                m("div", {class: "col-md-3"}, [
                                    sbAdmin.form.mValueDisplay("Bot Name", {id: 'name',  }, vm.name()),
                                ]),
                                m("div", {class: "col-md-6"}, [
                                    sbAdmin.form.mValueDisplay("Bot Address", {id: 'address',  }, if vm.address() then vm.address() else m("span", {class: 'no'}, "[ none ]")),
                                ]),
                                m("div", {class: "col-md-3"}, [
                                    sbAdmin.form.mValueDisplay("Status", {id: 'status',  }, sbAdmin.stateutils.buildStateSpan(vm.state())),
                                ]),
                            ]),

                            m("div", { class: "row"}, [
                                m("div", {class: "col-md-4"}, [
                                    sbAdmin.form.mValueDisplay("Return Transaction Fee", {id: 'return_fee',  }, vm.returnFee()+' BTC'),
                                ]),
                                m("div", {class: "col-md-4"}, [
                                    sbAdmin.form.mValueDisplay("Confirmations", {id: 'confirmations_required', }, vm.confirmationsRequired()),
                                ]),
                            ]),

                            m("div", { class: "row"}, [
                                m("div", {class: "col-md-12"}, [
                                    sbAdmin.form.mValueDisplay("Bot Description", {id: 'description',  }, vm.description()),
                                ]),
                            ]),

                            m("div", { class: "row"}, [
                                m("div", {class: "col-md-12"}, [
                                    sbAdmin.form.mValueDisplay("Public Bot Address", {id: 'description',  }, [
                                        m("a", {href: botPublicAddress(vm)}, botPublicAddress(vm))
                                    ]),
                                ]),
                            ]),
                            m("div", { class: "row"}, [
                                m("div", {class: "col-md-12"}, [
                                    sbAdmin.form.mValueDisplay("Bot Popup Address", {id: 'description',  }, [
                                        m("a", {href: poupupBotAddress(vm), target: "_blank"}, poupupBotAddress(vm))
                                    ]),
                                ]),
                            ]),
                        ]),

                        # #### Balances
                        m("div", {class: "col-md-4"}, [
                            sbAdmin.form.mValueDisplay("Balances", {id: 'balances',  }, buildBalancesMElement(vm.balances())),
                        ]),
                    ]),


                    m("hr"),

                    vm.swaps().map (swap, offset)->
                        return swapGroup(offset+1, swap)

                    m("hr"),

                    m("h4", "Blacklisted Addresses"),
                    vm.blacklistAddressesGroup.buildValues(),
                    m("div", {class: "spacer1"}),


                    m("hr"),

                    # overflow/income address
                    vm.incomeRulesGroup.buildValues(),

                    m("hr"),

                    m("div", {class: "bot-events"}, [
                        m("div", {class: "pulse-spinner pull-right"}, [m("div", {class: "rect1",}),m("div", {class: "rect2",}),m("div", {class: "rect3",}),m("div", {class: "rect4",}),m("div", {class: "rect5",}),]),
                        m("h3", "Events"),
                        if vm.botEvents().length == 0 then m("div", {class:"no-events", }, "No Events Yet") else null,
                        m("ul", {class: "list-unstyled striped-list bot-list event-list"}, [
                            vm.botEvents().map (botEventObj)->
                                if not vm.showDebug and botEventObj.level <= 100
                                    return
                                dateObj = window.moment(botEventObj.createdAt)
                                return m("li", {class: "bot-list-entry event"}, [
                                    m("div", {class: "labelWrapper"}, buildMLevel(botEventObj.level)),
                                    m("span", {class: "date", title: dateObj.format('MMMM Do YYYY, h:mm:ss a')}, dateObj.format('MMM D h:mm a')),
                                    m("span", {class: "msg"}, botEventObj.event?.msg),
                                ])
                        ]),
                        m("div", {class: "pull-right"}, [
                            m("a[href='#show-debug']", {onclick: vm.toggleDebugView, class: "btn #{if vm.showDebug then 'btn-warning' else 'btn-default'} btn-xs", style: {"margin-right": "16px",} }, [
                                if vm.showDebug then "Hide Debug" else "Show Debug"
                            ]),
                        ]),
                    ]),

                    m("div", {class: "spacer1"}),
                    m("hr"),

                    m("div", {class: "bot-payments"}, [
                        m("h3", "Payment Status"),
                        m("div", { class: "row"}, [
                                m("div", {class: "col-md-4"}, [
                                    sbAdmin.form.mValueDisplay("Payment Plan", {id: 'rate',  }, sbAdmin.planutils.paymentPlanDesc(vm.paymentPlan())),
                                ]),
                                m("div", {class: "col-md-6"}, [
                                    sbAdmin.form.mValueDisplay("Payment Address", {id: 'paymentAddress',  }, vm.paymentAddress()),
                                ]),
                                m("div", {class: "col-md-2"}, [
                                    sbAdmin.form.mValueDisplay("Account Balance", {id: 'value',  }, if vm.paymentBalance() == '' then '-' else vm.paymentBalance()+' BTC'),
                                ]),
                        ]),
                    ]),

                    m("a[href='/admin/payments/bot/#{vm.resourceId()}']", {class: "btn btn-info", config: m.route}, "View Payment Details"),

                    m("div", {class: "spacer1"}),

                    m("hr"),

                    m("div", {class: "spacer2"}),

                    m("a[href='/admin/edit/bot/#{vm.resourceId()}']", {class: "btn btn-success", config: m.route}, "Edit This Bot"),
                    m("a[href='/admin/dashboard']", {class: "btn btn-default pull-right", config: m.route}, "Back to Dashboard"),

                ]),


        ])
        return [sbAdmin.nav.buildNav(), sbAdmin.nav.buildInContainer(mEl)]

    sbAdmin.ctrl.botView.UnloadEvent