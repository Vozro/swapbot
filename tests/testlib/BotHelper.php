<?php

use Illuminate\Contracts\Validation\ValidationException;
use Illuminate\Foundation\Bus\DispatchesCommands;
use Rhumsaa\Uuid\Uuid;
use Swapbot\Commands\CreateBot;
use Swapbot\Models\Data\SwapConfig;
use Swapbot\Repositories\BotRepository;

class BotHelper  {

    use DispatchesCommands;

    function __construct(BotRepository $bot_repository) {
        $this->bot_repository = $bot_repository;
    }

    public function sampleBotVars() {
        return [
            'name'                => 'Sample Bot One',
            'description'         => 'The bot description goes here.',
            'active'              => false,
            'address'             => null,
            'payment_address_id'  => null,
            'receive_monitor_id'  => null,
            'send_monitor_id'     => null,
            'balances'            => null,
            'balances_updated_at' => null,
            'blacklist_addresses' => ['1JY6wKwW5D5Yy64RKA7rDyyEdYrLSD3J6B'],

            'swaps' => [
                [
                    'in'       => 'BTC',
                    'out'      => 'LTBCOIN',
                    'strategy' => 'rate',
                    'rate'     => 0.00000150,
                ],
            ],
        ];
    }

    public function getSampleBot($user) {
        $bots = $this->bot_repository->findByUser($user)->toArray();
        $bot = $bots ? $bots[0] : null;
        if (!$bot) {
            $bot = $this->newSampleBot($user);
        }
        return $bot;
    }


    // creates a bot
    //   directly in the repository (no validation)
    public function newSampleBot($user=null, $bot_vars=[]) {
        $attributes = array_replace_recursive($this->sampleBotVars(), $bot_vars);
        if ($user == null) {
            $user = app()->make('UserHelper')->getSampleUser();
        }
        $attributes['user_id'] = $user['id'];

        try {
            if (!isset($attributes['uuid'])) {
                $uuid = Uuid::uuid4()->toString();
                $attributes['uuid'] = $uuid;
            }

            if (isset($attributes['swaps'])) {
                $swap_configs = [];
                foreach ($attributes['swaps'] as $swap_config_data) {
                    $swap_configs[] = SwapConfig::createFromSerialized($swap_config_data);
                }
                $attributes['swaps'] = $swap_configs;
            }

            $bot_model = $this->bot_repository->create($attributes);
            return $bot_model;
        } catch (ValidationException $e) {
            throw new Exception("ValidationException: ".json_encode($e->errors()->all(), 192), $e->getCode());
        }
    }



    // uses a command to validate and sanitize the input
    public function newSampleBotWothCommand($user=null, $bot_vars=[]) {
        $attributes = array_replace_recursive($this->sampleBotVars(), $bot_vars);
        if ($user == null) {
            $user = app()->make('UserHelper')->getSampleUser();
        }
        $attributes['user_id'] = $user['id'];

        try {
            $uuid = Uuid::uuid4()->toString();
            $attributes['uuid'] = $uuid;
            $this->dispatch(new CreateBot($attributes));

            // now load the model
            return $this->bot_repository->findByUuid($uuid);
        } catch (ValidationException $e) {
            throw new Exception("ValidationException: ".json_encode($e->errors()->all(), 192), $e->getCode());
        }
    }

}
