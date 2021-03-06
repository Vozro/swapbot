<?php

namespace Swapbot\Statemachines\BotCommand;

use Exception;
use Swapbot\Models\Bot;
use Swapbot\Models\Data\BotState;
use Swapbot\Statemachines\BotCommand\BotCommand;


/*
* LeaseExpired
*/
class LeaseExpired extends BotCommand {

    /**
     */
    public function __invoke(Bot $bot)
    {
        // update the bot state in the database
        $this->updateBotState($bot, BotState::PAYING);

    }

    /**
     * 
     * @return string
     */
    public function __toString()
    {
        return 'Payment Exhausted';
    }



}
