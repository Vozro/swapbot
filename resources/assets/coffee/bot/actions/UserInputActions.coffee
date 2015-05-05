UserInputActions = do ()->
    exports = {}

    exports.chooseOutAsset = (chosenOutAsset)->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_CHOOSE_OUT_ASSET
            outAsset: chosenOutAsset
        })
        return

    exports.chooseSwapConfig = (chosenSwapConfig)->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_CHOOSE_SWAP_CONFIG
            swapConfig: chosenSwapConfig
        })
        return

    exports.updateOutAmount = (newOutAmount)->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_CHOOSE_OUT_AMOUNT
            outAmount: newOutAmount
        })
        return

    exports.chooseSwap = (swap)->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_CHOOSE_SWAP
            swap      : swap
        })
        return

    exports.clearSwap = ()->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_CLEAR_SWAP
        })
        return


    exports.updateEmailValue = (email)->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_UPDATE_EMAIL_VALUE
            email: email
        })
        return

    exports.submitEmail = ()->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_USER_SUBMIT_EMAIL
        })
        return



    exports.goBackOnClick = (e)->
        e.preventDefault()
        exports.goBack()
        return

    exports.goBack = ()->
        Dispatcher.dispatch({
            actionType: BotConstants.BOT_GO_BACK
        })
        return


    # #############################################
    return exports