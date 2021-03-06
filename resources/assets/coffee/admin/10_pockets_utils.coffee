# ---- begin references
swapbot = swapbot or {}; swapbot.formatters = require '../shared/formatters'
# ---- end references

# pocketsUtils functions
pocketsUtils = {}

pocketsUrl = null
pocketsImage = null

pocketsUtils.buildPaymentButton = (address, label, amount=null, acceptedTokens='btc')->
    return null if not pocketsUrl

    encodedLabel = encodeURIComponent(label).replace(/[!'()*]/g, escape)
    urlAttributes = "?address="+address+"&label="+encodedLabel+"&tokens="+acceptedTokens;
    if amount?
        urlAttributes += '&amount='+swapbot.formatters.formatCurrencyAsNumber(amount)

    return m("a", {href: pocketsUrl+urlAttributes, class: "pocketsLink", title: "Pay Using Tokenly Pockets", target: "_blank"}, [
        # m('img', {src: pocketsImage, height: '24px', 'width': '24px'})
        # m('img', {src: pocketsImage, height: '56px', 'width': '152px'})
        m('img', {src: pocketsImage, height: '32px', 'width': '87px'})
    ])



pocketsUtils.exists = ()->
    return pocketsUrl?

# init on document ready
jQuery ($)->
    maxAttempts = 10
    attempts = 0
    tryToLoadURL = ()->
        ++attempts

        pocketsUrl = $('.pockets-url').text()
        if pocketsUrl == ''
            pocketsUrl = null
            if attempts > maxAttempts
                # console.log "Pockets not found after #{maxAttempts} attempts - giving up"
                return
            timeoutRef = setTimeout(tryToLoadURL, 250)
            return

        pocketsImage = $('.pockets-image').text()


    tryToLoadURL()

    return


module.exports = pocketsUtils

