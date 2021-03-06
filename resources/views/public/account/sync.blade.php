@extends('public.base')

@section('header_content')
<h1>My Tokenpass Account</h1>
@stop

@section('content')
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-3">
                @include('public.account.includes.sidebar')
            </div>
            <div class="col-md-9">
                <h2>Hello {{$user['name']}}</h2>

                <div class="spacer1"></div>

                @if ($synced)
                    <p>Your Swapbot Account settings are now <strong>up to date</strong> with your Tokenpass Account.</p>

                    <p>To make changes to your account, please <a target="_blank" href="{{$tokenpassUpdateUrl}}">edit your Tokenly Account</a> and then Sync your account again.</p>

                    <div class="spacer1"></div>

                    <p>
                        <a href="/account/sync" class="btn btn-success">Sync My Account</a>
                        <a href="/account/welcome" class="btn btn-default">Return</a>

                    </p>
                @else
                    <p>Please authorize Tokenpass to sync your information with Swapbot by clicking the button below.</p>

                    <p>
                        <a href="/account/authorize" class="btn btn-success">Sync My Account</a>
                        <a href="/account/welcome" class="btn btn-default">Return</a>

                    </p>

                @endif

            </div>
        </div>
    </div>


@stop
