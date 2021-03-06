<?php

namespace Swapbot\Swap\Processor;

use Exception;
use Illuminate\Foundation\Bus\DispatchesCommands;
use Illuminate\Support\Facades\Log;
use Swapbot\Commands\ProcessIncomeForwardingForAllBots;
use Swapbot\Commands\ProcessPendingSwapsForBot;
use Swapbot\Commands\ReconcileBotPaymentState;
use Swapbot\Commands\ReconcileBotState;
use Swapbot\Commands\ReconcileBotSwapStates;
use Swapbot\Models\Data\BotState;
use Swapbot\Repositories\BlockRepository;
use Swapbot\Repositories\BotRepository;
use Tokenly\LaravelEventLog\Facade\EventLog;

class BlockEventProcessor {

    use DispatchesCommands;

    /**
     * Create the command handler.
     *
     * @return void
     */
    public function __construct(BotRepository $bot_repository, BlockRepository $block_repository)
    {
        $this->bot_repository   = $bot_repository;
        $this->block_repository = $block_repository;
    }


    public function handleBlock($xchain_notification) {
        $create_vars = [
            'height' => $xchain_notification['height'],
            'hash'   => $xchain_notification['hash'],
        ];
        $this->block_repository->create($create_vars);

        // bring all bots up to date
        foreach ($this->bot_repository->findAll() as $bot) {
            try {
                // ignore SHUTDOWN bots
                if (in_array($bot['state'], [BotState::SHUTDOWN])) {
                    continue;
                }

                // make sure the bot is in good standing
                $this->dispatch(new ReconcileBotState($bot));

                // check the bot payment state
                $this->dispatch(new ReconcileBotPaymentState($bot));

                // and process all pending swaps (swaps may have timed out)
                $this->dispatch(new ProcessPendingSwapsForBot($bot, $xchain_notification['height']));
            } catch (Exception $e) {
                EventLog::logError('reconcileBot.error', $e, ['botName' => $bot['name'], 'botId' => $bot['id'],]);
            }
        }

        // process any income forwarding payments that are pending
        $this->dispatch(new ProcessIncomeForwardingForAllBots());
    }

}
