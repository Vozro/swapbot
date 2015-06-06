# form functions
sbAdmin.form = do ()->
    form = {}

    form.mValueDisplay = (label, attributes, value)->
        inputProps = sbAdmin.utils.clone(attributes)
        inputProps.class = 'form-control-static' if not inputProps.class?

        id = inputProps.id or 'value'

        return m("div", {class: "form-group"}, [
            m("label", {for: id, class: 'control-label'}, label),
            inputEl = m("div", inputProps, value)
        ])

    form.mFormField = (label, attributes, prop)->
        inputEl = form.mInputEl(attributes, prop)

        return m("div", {class: "form-group"}, [
            m("label", {for: attributes.id, class: 'control-label'}, label),
            inputEl,
        ])

    form.mInputEl = (attributes, prop)->
        inputProps = sbAdmin.utils.clone(attributes)
        name = inputProps.name or inputProps.id

        if attributes.onchange?
            inputProps.onchange = (e)->
                (attributes.onchange)(e)
                return (m.withAttr("value", prop))(e)
        else
            inputProps.onchange = m.withAttr("value", prop)
        inputProps.value = prop()
        
        # defaults
        inputProps.class = 'form-control' if not inputProps.class?
        inputProps.name = inputProps.id if not inputProps.name?

        switch inputProps.type
            when 'textarea'
                delete inputProps.type
                inputProps.rows = inputProps.rows or 3
                inputEl = m("textarea", inputProps)
            when 'select'
                delete inputProps.type
                options = inputProps.options or {'': '- None -'}
                inputEl = m("select", inputProps, options.map((opt)->
                    return m("option", {value: opt.v, label: opt.k}, opt.k)
                ))
            else
                inputEl = m("input", inputProps)


        return inputEl;


    form.mSubmitBtn = (label)->
        return m("button", {type: 'submit', class: 'btn btn-primary'}, label)



    form.mAlerts = (errorsProp)->
        # console.log "errorsProp()=", errorsProp()
        return null if errorsProp().length == 0
        return m("div", {class: "alert alert-danger", role: "alert", }, [
            m("strong", "An error occurred."),
            m("ul", {class: "list-unstyled"}, [
                errorsProp().map((errorMsg)->
                    m('li', errorMsg)
                ),
            ]),
        ])


    form.mForm = (props, elAttributes, children)->
        # props.errors([]) if props.errors?

        formAttributes = sbAdmin.utils.clone(elAttributes)
        
        status = props.status() if props.status?
        # console.log "status=#{status}"
        if status == 'submitting'
            formAttributes.style = {opacity: 0.25}

        return m("form", formAttributes, children)

    # returns a promise
    form.submit = (apiCallFn, apiCallArgs, errorsProp, formStatusProp)->
        # don't submit twice
        return if formStatusProp() == 'submitting'

        # clear the errors
        errorsProp([])

        # mark form as submitting
        formStatusProp('submitting')

        # submit to the api
        return apiCallFn.apply(null, apiCallArgs).then(
            (apiResponse)->
                # console.log "apiResponse=", apiResponse
                # success
                formStatusProp('submitted')
                return apiResponse
            , (error)->
                # console.log "error=", error
                # failed
                formStatusProp('active')
                errorsProp(error.errors)
                # make sure to pass the errors up the chain

                # reject the parent
                return m.deferred().reject(error).promise
        )

    form.yesNoOptions = ()->
        return [
            {k: "Yes", v: '1'}
            {k: "No",  v: '0'}
        ]

    return form
