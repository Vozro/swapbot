<?php

namespace Swapbot\Swap\Processor;

use ArrayObject;
use Exception;
use Illuminate\Foundation\Bus\DispatchesCommands;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Swapbot\Commands\ProcessIncomeForwardingForAllBots;
use Swapbot\Models\BotEvent;
use Swapbot\Models\Data\BotState;
use Swapbot\Models\Data\SwapState;
use Swapbot\Models\Data\SwapStateEvent;
use Swapbot\Providers\Accounts\Facade\AccountHandler;
use Swapbot\Repositories\BotRepository;
use Swapbot\Repositories\SwapRepository;
use Swapbot\Repositories\TransactionRepository;
use Swapbot\Swap\Logger\BotEventLogger;
use Swapbot\Swap\Processor\Util\BalanceUpdater;
use Tokenly\LaravelEventLog\Facade\EventLog;

class SendEventProcessor {

    use DispatchesCommands;

    /**
     * Create the command handler.
     *
     * @return void
     */
    public function __construct(BotRepository $bot_repository, SwapRepository $swap_repository, TransactionRepository $transaction_repository, BotEventLogger $bot_event_logger, BalanceUpdater $balance_updater)
    {
        $this->bot_repository         = $bot_repository;
        $this->swap_repository        = $swap_repository;
        $this->transaction_repository = $transaction_repository;
        $this->bot_event_logger       = $bot_event_logger;
        $this->balance_updater        = $balance_updater;
    }


    public function handleSend($xchain_notification) {
        $found = false;

        // find the bot 
        //   if this is a send from the the public address
        $bot = $this->bot_repository->findBySendMonitorID($xchain_notification['notifiedAddressId']);
        if ($bot) {
            $found = true;
        }


        // find the bot 
        //   if this is a send from the payment address 
        //   this could be an initial fuel transaction, or an income forwarding transaction
        if (!$found) {
            $bot = $this->bot_repository->findByPaymentSendMonitorID($xchain_notification['notifiedAddressId']);
            if ($bot) {
                $found = true;
            }
        }
        

        if (!$found) { throw new Exception("Unable to find bot for send monitor {$xchain_notification['notifiedAddressId']}", 1); }

        // lock the transaction
        $tx_process = $this->bot_repository->executeWithLockedBot($bot, function($bot) use ($xchain_notification) {

            // load or create a new transaction from the database
            $transaction_model = $this->findOrCreateTransaction($xchain_notification, $bot['id'], 'send');
            if (!$transaction_model) { throw new Exception("Unable to access database", 1); }

            // find any swap associated with this send
            $swap = $this->findSwapFromNotification($xchain_notification, $bot);

            // initialize a DTO (data transfer object) to hold all the variables
            $tx_process = new ArrayObject([
                'transaction'                  => $transaction_model,
                'xchain_notification'          => $xchain_notification,
                'bot'                          => $bot,
                'swap'                         => $swap,

                'confirmations'                => $xchain_notification['confirmations'],
                'is_confirmed'                 => $xchain_notification['confirmed'],
                'destination'                  => $xchain_notification['sources'][0],

                'tx_is_handled'                => false,
                'transaction_update_vars'      => [],

                'should_sync_bot_balances'     => false,
                'bot_balances_synced'          => false,
            ]);



            // previously processed transaction
            $this->handlePreviouslyProcessedTransaction($tx_process);

            // process shutdown send
            $this->processSutdownSend($tx_process);

            // process income forwarding send
            $this->processIncomeForwardingSend($tx_process);

            // process all swaps
            $this->processMatchedSwap($tx_process);

            // update bot balances
            $this->handleUpdateBotBalances($tx_process);

            // done going through swaps - update the transaction
            $this->updateTransaction($tx_process);

            return $tx_process;
        });

        // if any balances were updated, then process income forwarding for all bots
        $this->handleIncomeForwarding($tx_process);

        return $bot;
    }


    ////////////////////////////////////////////////////////////////////////

    protected function handlePreviouslyProcessedTransaction($tx_process) {
        if ($tx_process['tx_is_handled']) { return; }

        $transaction_model = $tx_process['transaction'];
        if ($transaction_model['processed']) {
            $xchain_notification = $tx_process['xchain_notification'];
            $bot = $tx_process['bot'];

            $tx_process['tx_is_handled'] = true;
            $tx_process['transaction_update_vars']['confirmations'] = $tx_process['xchain_notification']['confirmations'];

            if ($this->isShutdownTransaction($tx_process)) {
                // log the confirmed income forward
                $this->bot_event_logger->logShutdownTxSent($bot, $xchain_notification);

            } else if ($this->isIncomeForwardingTransaction($tx_process)) {
                // log the confirmed income forward
                $this->bot_event_logger->logIncomeForwardingTxSent($bot, $xchain_notification);

            } else {
                // log a swap send confirmation
                $swap = $tx_process['swap'];
                $receipt_update_vars = ['confirmationsOut' => $tx_process['xchain_notification']['confirmations'],];
                $tx_process['swap_update_vars']['receipt'] = $receipt_update_vars;
                $this->bot_event_logger->logSwapSendConfirmed($bot, $swap, $receipt_update_vars);

            }


        }
    }


    protected function processSutdownSend($tx_process) {
        if ($tx_process['tx_is_handled']) { return; }

        // see if this is a shutdown send from the public address
        //   to the shutdown address
        if ($this->isShutdownTransaction($tx_process)) {
            $bot                 = $tx_process['bot'];
            $xchain_notification = $tx_process['xchain_notification'];

            $this->bot_event_logger->logShutdownTxSent($bot, $xchain_notification);
            $tx_process['tx_is_handled'] = true;

            if ($tx_process['is_confirmed']) {
                $tx_process['transaction_update_vars']['processed'] = true;
            }
        }
    }

    protected function processIncomeForwardingSend($tx_process) {
        if ($tx_process['tx_is_handled']) { return; }

        // see if this is a send from the public address
        //   to the forwarding address
        if ($this->isIncomeForwardingTransaction($tx_process)) {
            $bot                 = $tx_process['bot'];
            $xchain_notification = $tx_process['xchain_notification'];

            $this->bot_event_logger->logIncomeForwardingTxSent($bot, $xchain_notification);
            $tx_process['tx_is_handled'] = true;

            if ($tx_process['is_confirmed']) {
                $tx_process['transaction_update_vars']['processed'] = true;
            }
        }
    }

    protected function processMatchedSwap($tx_process) {
        if ($tx_process['tx_is_handled']) { return; }


        $bot                 = $tx_process['bot'];
        $swap                = $tx_process['swap'];
        $xchain_notification = $tx_process['xchain_notification'];
        $is_confirmed        = $tx_process['is_confirmed'];
        $destination         = $xchain_notification['destinations'][0];
        $quantity            = $xchain_notification['quantity'];
        $asset               = $xchain_notification['asset'];
        $confirmations       = $xchain_notification['confirmations'];

        // if no matched swap was found, then log it and return
        if (!$swap) {
            $this->bot_event_logger->logUnknownSendTransaction($bot, $xchain_notification);
            return;
        }


        // get all swaps that are in state sent
        $txid = $tx_process['xchain_notification']['txid'];

        $receipt_update_vars = null;

        if ($is_confirmed) {
            // log the send confirmed (completed)
            $receipt_update_vars = [
                'confirmationsOut' => $tx_process['xchain_notification']['confirmations'],
                'assetOut'         => $tx_process['xchain_notification']['asset'],
                'quantityOut'      => $tx_process['xchain_notification']['quantity'],
            ];
            $swap_update_vars_for_log = ['state' => SwapState::COMPLETE, ];
            $this->bot_event_logger->logSwapSendConfirmed($bot, $swap, $receipt_update_vars, $swap_update_vars_for_log);
            $this->bot_event_logger->logSwapCompleted($bot, $swap, $receipt_update_vars, $swap_update_vars_for_log);

            // close the swap account by moving all the remaining funds back
            AccountHandler::closeSwapAccount($swap);

            //   move the swap into state completed
            $swap->stateMachine()->triggerEvent(SwapStateEvent::SWAP_COMPLETED);
            $tx_process['tx_is_handled'] = true;


            // sync the bot balances
            $tx_process['should_sync_bot_balances'] = true;
            

            // this transaction was processed
            $tx_process['transaction_update_vars']['processed']     = true;
            $tx_process['transaction_update_vars']['confirmations'] = $tx_process['xchain_notification']['confirmations'];

        } else {
            // just an unconfirmed transaction
            $receipt_update_vars = [
                'confirmationsOut' => $tx_process['xchain_notification']['confirmations'],
                'assetOut'         => $tx_process['xchain_notification']['asset'],
                'quantityOut'      => $tx_process['xchain_notification']['quantity'],
            ];
            $this->bot_event_logger->logUnconfirmedSwapSend($bot, $swap, $receipt_update_vars);
        }

        // update the swap receipt
        if ($receipt_update_vars) {
            $receipt_update_vars = array_merge(is_array($swap['receipt']) ? $swap['receipt'] : [], $receipt_update_vars);
            $this->swap_repository->update($swap, ['receipt' => $receipt_update_vars]);
        }
    }


    protected function handleUpdateBotBalances($tx_process) {
        if (!$tx_process['should_sync_bot_balances']) { return; }

        // update the bot's balances
        $this->balance_updater->syncBalances($tx_process['bot']);
        $tx_process['transaction_update_vars']['balances_applied'] = true;

        $tx_process['bot_balances_synced'] = true;

    }

    protected function updateTransaction($tx_process) {
        if ($tx_process['transaction_update_vars']) {

            $update_vars = $tx_process['transaction_update_vars'];
            $this->transaction_repository->update($tx_process['transaction'], $update_vars);
        }
    }

    protected function handleUpdateSwapModel($swap_process) {
        // update the swap
        if ($swap_process['swap_update_vars']) {
            $update_vars = $this->swap_repository->mergeUpdateVars($swap_process['swap'], $swap_process['swap_update_vars']);
            $this->swap_repository->update($swap_process['swap'], $update_vars);
        }
    }



    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    // Shutdown Transaction
    
    protected function isShutdownTransaction($tx_process) {
        $bot                 = $tx_process['bot'];
        Log::debug("isShutdownTransaction \$bot['state']=".json_encode($bot['state'], 192));
        if ($bot['state'] != BotState::SHUTDOWN) { return false; }

        $xchain_notification = $tx_process['xchain_notification'];
        if (
            in_array($bot['address'], $xchain_notification['sources'])
            AND $xchain_notification['destinations'][0] == $bot['shutdown_address']
        ) {
            return true;
        }

        return false;
    }

    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    // Income Forwarding
    
    protected function isIncomeForwardingTransaction($tx_process) {
        $bot                 = $tx_process['bot'];
        $xchain_notification = $tx_process['xchain_notification'];

        if (
            in_array($bot['address'], $xchain_notification['sources'])
            AND in_array($xchain_notification['destinations'][0], $bot->getAllIncomeForwardingAddresses())
        ) {
            return true;
        }

        return false;
    }


    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    // Transaction
    
    protected function findOrCreateTransaction($xchain_notification, $bot_id, $type) {
        return $this->transaction_repository->findOrCreateTransaction($xchain_notification['txid'], $bot_id, $type, ['xchain_notification' => $xchain_notification]);
    }

    protected function handleIncomeForwarding($tx_process) {
        if (!$tx_process['bot_balances_synced']) { return; }

        // process any payments that are pending
        $this->dispatch(new ProcessIncomeForwardingForAllBots());
    }


    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    // Swap

    protected function findSwapFromNotification($xchain_notification, $bot) {
        // get all swaps that are in state sent
        $txid = $xchain_notification['txid'];
        $states = [SwapState::SENT, SwapState::COMPLETE, SwapState::REFUNDED];
        $swaps = $this->swap_repository->findByBotIDWithStates($bot['id'], $states);

        foreach($swaps as $swap) {
            $receipt = $swap['receipt'];
            if (isset($receipt['txidOut']) AND $receipt['txidOut'] == $txid) {
                return $swap;
            }
        }

        return null;
    }    


}
