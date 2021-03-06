<?php

namespace Swapbot\Swap\Processor;

use ArrayObject;
use Carbon\Carbon;
use Exception;
use Illuminate\Foundation\Bus\DispatchesCommands;
use Illuminate\Support\Facades\Log;
use Swapbot\Commands\ReconcileSwapState;
use Swapbot\Models\Bot;
use Swapbot\Models\Data\BotState;
use Swapbot\Models\Data\RefundConfig;
use Swapbot\Models\Data\SwapConfig;
use Swapbot\Models\Data\SwapState;
use Swapbot\Models\Data\SwapStateEvent;
use Swapbot\Models\Swap;
use Swapbot\Models\Transaction;
use Swapbot\Providers\Accounts\Facade\AccountHandler;
use Swapbot\Repositories\BotRepository;
use Swapbot\Repositories\SwapRepository;
use Swapbot\Swap\Exception\SwapStrategyException;
use Swapbot\Swap\Logger\BotEventLogger;
use Swapbot\Swap\Tokenpass\Facade\TokenpassHandler;
use Swapbot\Swap\Util\RequestIDGenerator;
use Tokenly\CurrencyLib\CurrencyUtil;
use Tokenly\CurrencyLib\Quantity;
use Tokenly\LaravelEventLog\Facade\EventLog;
use Tokenly\XChainClient\Client;

class SwapProcessor {

    use DispatchesCommands;

    const DEFAULT_REGULAR_DUST_SIZE = 0.00005430;
    const PERMANENTLY_FAIL_AFTER_CONFIRMATIONS = 6;

    /**
     * Create the command handler.
     *
     * @return void
     */
    public function __construct(Client $xchain_client, SwapRepository $swap_repository, BotRepository $bot_repository, BotEventLogger $bot_event_logger)
    {
        $this->xchain_client    = $xchain_client;
        $this->swap_repository  = $swap_repository;
        $this->bot_repository   = $bot_repository;
        $this->bot_event_logger = $bot_event_logger;
    }


    public function findSwapFromSwapConfig(SwapConfig $swap_config, $bot_id, $transaction_id) {
        // swap variables
        $swap_name      = $swap_config->buildName();

        // try to find an existing swap
        $existing_swap = $this->swap_repository->findByBotIDTransactionIDAndName($bot_id, $transaction_id, $swap_name);
        if ($existing_swap) { return $existing_swap; }

        return null;
    }

    public function createNewSwap($swap_config, Bot $bot, Transaction $transaction) {
        // swap variables
        $swap_name = $swap_config->buildName();

        // let the swap strategy initialize the receipt
        //   this locks in any quotes if quotes are used
        $strategy = $swap_config->getStrategy();
        $in_quantity = $transaction['xchain_notification']['quantity'];
        $initial_receipt_vars = $strategy->calculateInitialReceiptValues($swap_config, $in_quantity, $swap_config->buildAppliedSwapRules($bot['swap_rules']));
        // Log::debug("createNewSwap \$transaction=".json_encode($transaction, 192));
        Log::debug("\$in_quantity=$in_quantity \$initial_receipt_vars=".json_encode($initial_receipt_vars, 192));

        // new swap vars
        $new_swap = $this->swap_repository->create([
            'name'           => $swap_config->buildName(),
            'definition'     => $swap_config->serialize(),
            'state'          => 'brandnew',
            'bot_id'         => $bot['id'],
            'transaction_id' => $transaction['id'],
            'receipt'        => $initial_receipt_vars,
        ]);

        // log the new Swap
        $this->bot_event_logger->logNewSwap($bot, $new_swap, ['txidIn' => $transaction['xchain_notification']['txid'], ]);

        return $new_swap;
    }

    public function processSwap(Swap $swap, $block_height) {
        try {
            $swap_process = null;

            // start by checking the status of the bot
            //   if the bot is not active, don't process anything else
            $bot = $swap->bot;
            if (!$this->botCanProcessSwap($bot, $swap)) { return $swap; }

            // start by reconciling the swap state
            $this->dispatch(new ReconcileSwapState($swap, $block_height));

            $swap_config = $swap->getSwapConfig();

            // get the transaction, bot and the xchain notification
            $transaction         = $swap->transaction;
            $xchain_notification = $transaction['xchain_notification'];

            // initialize a DTO (data transfer object) to hold all the variables for this swap
            $swap_process = new ArrayObject([
                'swap'                     => $swap,
                'swap_config'              => $swap_config,
                'swap_id'                  => $swap_config->buildName(),

                'block_height'             => $block_height,
                'transaction'              => $transaction,
                'bot'                      => $bot,

                'xchain_notification'      => $xchain_notification,
                'in_asset'                 => $xchain_notification['asset'],
                'in_quantity'              => $xchain_notification['quantity'],
                'destination'              => $xchain_notification['sources'][0],
                'confirmations'            => $transaction['confirmations'],
                'is_confirmed'             => $xchain_notification['confirmed'],

                'quantity'                 => null,
                'asset'                    => null,
                'swap_was_handled'         => false,

                'swap_update_vars'         => [],
                'state_trigger'            => false,
                'swap_was_sent'            => false,
            ]);

            // calculate the receipient's quantity and asset
            $swap_process['quantity'] = $swap['receipt']['quantityOut'];
            $swap_process['asset']    = $swap['receipt']['assetOut'];

            // check the swap state
            $this->resetSwapStateForProcessing($swap_process);

            // handle an unconfirmed TX
            $this->handleUnconfirmedTX($swap_process);

            // see if the swap has already been handled
            $this->handlePreviouslyProcessedSwap($swap_process);

            // see if the swap is still confirming
            $this->handleUnconfirmedSwap($swap_process);

            // if all the checks above passed
            //   then we should process this swap
            $this->doSwap($swap_process);

            // if anything was updated, then update the swap
            $this->handleUpdateSwapModel($swap_process);

        } catch (Exception $e) {
            // log any failure
            if ($e instanceof SwapStrategyException) {
                EventLog::logError('swap.failed', $e);
                $data = $e->getErrorData();
                $data['swapId'] = $swap['uuid'];
                $this->bot_event_logger->logLegacyBotEventWithoutEventLog($swap_process['bot'], $e->getErrorName(), $e->getErrorLevel(), $e->getErrorData());
            } else {
                EventLog::logError('swap.failed', $e);
                if ($swap_process !== null) {
                    $receipt = (isset($swap_process['swap_update_vars']['receipt'])) ? $swap_process['swap_update_vars']['receipt'] : null;
                    $bot = (isset($swap_process['bot'])) ? $swap_process['bot'] : null;
                    $this->bot_event_logger->logSwapFailed($bot, $swap, $e, $receipt);
                }
            }
        }


        // see if a swap failed permanently
        $this->checkForPermanentlyFailedSwap($swap_process);

        // if a state change was triggered, then update the swap state
        //   this can happen even if there was an error
        $this->handleUpdateSwapState($swap_process);

        // processed this swap
        return $swap;
    }


    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    protected function resetSwapStateForProcessing($swap_process) {
        if ($swap_process['swap_was_handled']) { return; }

        $swap = $swap_process['swap'];
        switch ($swap['state']) {
            case SwapState::ERROR:
                // the swap errored last time
                //   switch the swap back to the ready state
                //   in order to try again
                $this->bot_event_logger->logSwapRetry($swap_process['bot'], $swap_process['swap']);
                $swap_process['swap']->stateMachine()->triggerEvent(SwapStateEvent::SWAP_RETRY);
                break;
        }
    }

    protected function botCanProcessSwap($bot, $swap) {
        // treat a low fuel state as active
        if ($bot['state'] == BotState::LOW_FUEL) {
            // delegate this to the swap level
            return true;
        }

        return $bot->statemachine()->getCurrentState()->isActive();
    }

    protected function handleUnconfirmedTX($swap_process) {
        if ($swap_process['swap_was_handled']) { return; }

        // is this an unconfirmed tx?
        if (!$swap_process['is_confirmed']) {
            $swap_process['swap_was_handled'] = true;

            // mark details
            $receipt_update_vars = $this->buildReceiptUpdateVars($swap_process);

            // create or update the token promise with tokenpass
            $existing_promise_id = (isset($swap_process['swap']['receipt']) AND isset($swap_process['swap']['receipt']['promise_id'])) ? $swap_process['swap']['receipt']['promise_id'] : null;
            $promise_id = TokenpassHandler::updateOrCreateTokenPromise($swap_process['bot'], $existing_promise_id, $swap_process['destination'], Quantity::fromFloat($swap_process['quantity']), $swap_process['asset']);

            $receipt_update_vars['promise_id'] = $promise_id;

            // determine if this is an update
            $any_changed = false;
            $previous_receipt = $swap_process['swap']['receipt'];
            foreach($receipt_update_vars as $k => $v) {
                if (!isset($previous_receipt[$k]) OR $v != $previous_receipt[$k]) { $any_changed = true; }
            }
            Log::debug("\$promise_id=$promise_id \$any_changed=".json_encode($any_changed)." \$receipt_update_vars=".json_encode($receipt_update_vars, 192));
            // only update if something has changed
            if ($any_changed) {
                $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;
                $this->bot_event_logger->logSwapTransactionUpdate($swap_process['bot'], $swap_process['swap'], $receipt_update_vars);
            }
        }
    }

    protected function buildReceiptUpdateVars($swap_process, $overrides=null) {
        $receipt_update_vars = [
            'quantityIn'    => $swap_process['in_quantity'],
            'assetIn'       => $swap_process['in_asset'],
            'txidIn'        => $swap_process['transaction']['txid'],

            'quantityOut'   => $swap_process['quantity'],
            'assetOut'      => $swap_process['asset'],

            'confirmations' => $swap_process['confirmations'],
            'destination'   => $swap_process['destination'],
        ];

        if ($overrides !== null) { $receipt_update_vars = array_merge($receipt_update_vars, $overrides); }
        return $receipt_update_vars;
    }

    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    protected function handlePreviouslyProcessedSwap($swap_process) {
        if ($swap_process['swap_was_handled']) { return; }

        if ($swap_process['swap']->wasSent()) {
            // this swap has already been processed
            // don't process it
            $swap_process['swap_was_handled'] = true;

            // log as previously processed
            $this->bot_event_logger->logPreviouslyProcessedSwap($swap_process['bot'], $swap_process['xchain_notification'], $swap_process['destination'], $swap_process['quantity'], $swap_process['asset']);
        }
    }
    
    protected function handleUnconfirmedSwap($swap_process) {
        if ($swap_process['swap_was_handled']) { return; }

        // if the swap is not in a ready or confirmation state, we can't move it to confirming or confirmed
        if (!$swap_process['swap']->isReady() AND !$swap_process['swap']->isConfirming()) { return; }

        // Log::debug("\$swap_process['confirmations']=".json_encode($swap_process['confirmations'], 192));
        if ($swap_process['confirmations'] < $swap_process['bot']['confirmations_required']) {
            // move the swap into the confirming state
            $swap_process['state_trigger'] = SwapStateEvent::CONFIRMING;

            // create or update the token promise with tokenpass
            $existing_promise_id = (isset($swap_process['swap']['receipt']) AND isset($swap_process['swap']['receipt']['promise_id'])) ? $swap_process['swap']['receipt']['promise_id'] : null;
            $promise_id = TokenpassHandler::updateOrCreateTokenPromise($swap_process['bot'], $existing_promise_id, $swap_process['destination'], Quantity::fromFloat($swap_process['quantity']), $swap_process['asset']);
            Log::debug("handleUnconfirmedSwap \$existing_promise_id=".json_encode($existing_promise_id, 192)." returned \$promise_id=".json_encode($promise_id, 192));
            
            // don't process it any further
            $swap_process['swap_was_handled'] = true;

            // mark details
            $receipt_update_vars = [
                // 'type'          => 'pending',

                'quantityIn'    => $swap_process['in_quantity'],
                'assetIn'       => $swap_process['in_asset'],
                'txidIn'        => $swap_process['transaction']['txid'],

                'quantityOut'   => $swap_process['quantity'],
                'assetOut'      => $swap_process['asset'],

                'confirmations' => $swap_process['confirmations'],
                'destination'   => $swap_process['destination'],

                'promise_id'    => $promise_id,

                'timestamp'     => time(),
            ];

            $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;

            // log as confirming
            $swap_update_vars = ['state' => SwapState::CONFIRMING];
            $this->bot_event_logger->logConfirmingSwap($swap_process['bot'], $swap_process['swap'], $receipt_update_vars, $swap_update_vars);
        } else if ($swap_process['confirmations'] >= $swap_process['bot']['confirmations_required']) {
            if ($swap_process['swap']->isConfirming()) {

                // create or update the token promise with tokenpass
                $existing_promise_id = (isset($swap_process['swap']['receipt']) AND isset($swap_process['swap']['receipt']['promise_id'])) ? $swap_process['swap']['receipt']['promise_id'] : null;
                $promise_id = TokenpassHandler::updateOrCreateTokenPromise($swap_process['bot'], $existing_promise_id, $swap_process['destination'], Quantity::fromFloat($swap_process['quantity']), $swap_process['asset']);

                // mark details
                $receipt_update_vars = [
                    // 'type'          => 'pending',

                    'quantityIn'    => $swap_process['in_quantity'],
                    'assetIn'       => $swap_process['in_asset'],
                    'txidIn'        => $swap_process['transaction']['txid'],

                    'quantityOut'   => $swap_process['quantity'],
                    'assetOut'      => $swap_process['asset'],

                    'confirmations' => $swap_process['confirmations'],
                    'destination'   => $swap_process['destination'],

                    'promise_id'    => $promise_id,

                    'timestamp'     => time(),
                ];
                $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;

                // log the confirmed swap
                $swap_update_vars = ['state' => SwapState::READY];
                $this->bot_event_logger->logConfirmedSwap($swap_process['bot'], $swap_process['swap'], $receipt_update_vars, $swap_update_vars);

                // the swap just became confirmed
                //   update the state right now
                $swap_process['swap']->stateMachine()->triggerEvent(SwapStateEvent::CONFIRMED);


            }
        }

    }
    
    protected function doSwap($swap_process) {
        if ($swap_process['swap_was_handled']) { return; }
        $swap_config = $swap_process['swap_config'];
        $bot = $swap_process['bot'];
        $swap = $swap_process['swap'];


        // log out of stock or not ready
        if ($swap->isOutOfStock()) {
            $refund_config = $bot['refund_config'];
            // Log::debug("({$swap_process['block_height']}) swapShouldBeAutomaticallyRefunded: ".json_encode($refund_config->swapShouldBeAutomaticallyRefunded($swap, $swap_process['block_height']), 192));
            if ($refund_config->swapShouldBeAutomaticallyRefunded($swap, $swap_process['block_height'])) {
                // log automatic refund
                $this->bot_event_logger->logAutomaticRefund($bot, $swap, $refund_config);

                // do automatic refund
                $this->doRefund($swap_process, RefundConfig::REASON_OUT_OF_STOCK);

                return;
            }

            $this->bot_event_logger->logSwapOutOfStock($bot, $swap);
            return;
        }
        if (!$swap->isReady()) {
            $this->bot_event_logger->logSwapNotReady($bot, $swap);
            return;
        }

        $is_refunding = false;
        $refund_reason = null;
        $strategy = $swap_config->getStrategy();

        // check shutting down state for refund
        if (!$is_refunding) {
            if ($bot->isShuttingDown()) {
                $is_refunding = true;
                $refund_reason = RefundConfig::REASON_SHUTTING_DOWN;
            }
        }

        // check whitelist refund
        if (!$is_refunding) {
            if ($this->failsWhitelistTest($bot, $swap_process['destination'])) {
                $is_refunding = true;
                $refund_reason = RefundConfig::REASON_WHITELIST_MISMATCH;
                EventLog::log('Whitelist mismatch refund triggered', ['botName' => $bot['name'], 'swapId' => $swap['id']]);
            }
        }

        // check strategy for refund
        if (!$is_refunding) {
            $receipt_vars = $this->buildMergedReceiptVars($swap_process);
            $is_refunding = $strategy->shouldRefundTransaction($swap_config, $swap_process['in_quantity'], $swap_config->buildAppliedSwapRules($bot['swap_rules']), $receipt_vars);
            if ($is_refunding) {
                $refund_reason = $strategy->buildRefundReason($swap_config, $swap_process['in_quantity']);
            }
        }

        // check forced refund
        if (!$is_refunding) {
            $forced_refund = (isset($swap['receipt']) AND isset($swap['receipt']['forcedRefund']) AND $swap['receipt']['forcedRefund']);
            if ($forced_refund) {
                $is_refunding = true;
                $refund_reason = RefundConfig::REASON_MANUAL_REFUND;
                EventLog::log('Forced refund triggered', ['botName' => $bot['name'], 'swapId' => $swap['id']]);
            }
        }

        if ($is_refunding) {
            // refund
            $this->doRefund($swap_process, $refund_reason);
        } else {
            // do forward swap
            $this->doForwardSwap($swap_process);
        }
    }

    protected function doForwardSwap($swap_process) {
        // log the attempt to send
        $this->bot_event_logger->logSendAttempt($swap_process['bot'], $swap_process['swap'], $swap_process['xchain_notification'], $swap_process['destination'], $swap_process['quantity'], $swap_process['asset'], $swap_process['confirmations']);

        $fee = $swap_process['bot']['return_fee'];

        $change_out = isset($swap_process['swap']['receipt']['changeOut']) ? $swap_process['swap']['receipt']['changeOut'] : 0;
        if ($change_out > 0) {
            $dust_size = self::DEFAULT_REGULAR_DUST_SIZE + $swap_process['swap']['receipt']['changeOut'];
        } else {
            $dust_size = null;
        }

        // update the swap receipts (before the attempt)
        $receipt_update_vars = [
            'type'             => 'swap',

            'quantityIn'       => $swap_process['in_quantity'],
            'assetIn'          => $swap_process['in_asset'],
            'txidIn'           => $swap_process['transaction']['txid'],
            'confirmations'    => $swap_process['confirmations'],

            'quantityOut'      => $swap_process['quantity'],
            'assetOut'         => $swap_process['asset'],
            'confirmationsOut' => 0,

            'destination'      => $swap_process['destination'],

            'completedAt'      => time(),
            'timestamp'        => time(),
        ];
        $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;

        // send it
        try {
            $request_id = $this->generateSendHash('swap', $swap_process['bot'], $swap_process['swap'], $swap_process['destination'], $swap_process['quantity'], $swap_process['asset']);
            $send_result = $this->sendAssets($swap_process['swap'], $swap_process['bot'], $swap_process['destination'], $swap_process['quantity'], $swap_process['asset'], $fee, $dust_size, $request_id);
        } catch (Exception $e) {
            // move the swap into an error state
            $swap_process['state_trigger'] = SwapStateEvent::SWAP_ERRORED;

            throw $e;
        }

        // update the promise with the new TXID
        $existing_promise_id = (isset($swap_process['swap']['receipt']) AND isset($swap_process['swap']['receipt']['promise_id'])) ? $swap_process['swap']['receipt']['promise_id'] : null;
        $promise_id = TokenpassHandler::updateOrCreateTokenPromise($swap_process['bot'], $existing_promise_id, $swap_process['destination'], Quantity::fromFloat($swap_process['quantity']), $swap_process['asset'], $send_result['txid']);

        // update the txidOut
        $receipt_update_vars['txidOut'] = $send_result['txid'];
        $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;
        $swap_process['swap_update_vars']['completed_at'] = Carbon::now();


        // move the swap into the sent state
        $swap_process['state_trigger'] = SwapStateEvent::SWAP_SENT;

        // log it
        $swap_update_vars = ['state' => SwapState::SENT];
        $this->bot_event_logger->logSwapSent($swap_process['bot'], $swap_process['swap'], $receipt_update_vars, $swap_update_vars);

        // mark the swap as sent
        $swap_process['swap_was_sent'] = true;
    }

    protected function doRefund($swap_process, $refund_reason) {
        // send the refund
        try {
            list($out_quantity, $out_asset, $fee, $dust_size) = $this->buildRefundDetails($swap_process['bot'], $swap_process['xchain_notification']);

            // cancel the provisional transacton
            $existing_promise_id = (isset($swap_process['swap']['receipt']) AND isset($swap_process['swap']['receipt']['promise_id'])) ? $swap_process['swap']['receipt']['promise_id'] : null;
            if ($existing_promise_id) {
                TokenpassHandler::deleteTokenPromise($swap_process['bot'], $existing_promise_id);
            }

            // build trial receipt vars
            $receipt_update_vars = [
                'type'             => 'refund',
                'refundReason'     => $refund_reason,

                'quantityIn'       => $swap_process['in_quantity'],
                'assetIn'          => $swap_process['in_asset'],
                'txidIn'           => $swap_process['transaction']['txid'],

                'quantityOut'      => $out_quantity,
                'assetOut'         => $out_asset,
                'changeOut'        => null,
                'confirmationsOut' => 0,

                'confirmations'    => $swap_process['confirmations'],
                'destination'      => $swap_process['destination'],

                'promise_id'       => null,

                'completedAt'      => time(),
                'timestamp'        => time(),
            ];

            // log the attempt to refund
            $this->bot_event_logger->logRefundAttempt($swap_process['bot'], $swap_process['swap'], $receipt_update_vars);

            if ($out_quantity > 0) {
                // do the send
                $request_id = $this->generateSendHash('refund', $swap_process['bot'], $swap_process['swap'], $swap_process['destination'], $out_quantity, $out_asset);
                $send_result = $this->sendAssets($swap_process['swap'], $swap_process['bot'], $swap_process['destination'], $out_quantity, $out_asset, $fee, $dust_size, $request_id);
            } else {
                // return quantity was less than 0 - don't send any refund
                $send_result = ['txid' => null];
            }
        } catch (Exception $e) {
            // move the swap into an error state
            $swap_process['state_trigger'] = SwapStateEvent::SWAP_ERRORED;

            throw $e;
        }

        // update the swap receipt vars
        $receipt_update_vars['txidOut'] = $send_result['txid'];

        // update the swap
        $swap_process['swap_update_vars']['receipt'] = $receipt_update_vars;
        $swap_process['swap_update_vars']['completed_at'] = Carbon::now();

        // move the swap into the sent state
        $swap_process['state_trigger'] = SwapStateEvent::SWAP_REFUND;

        // log it
        $swap_update_vars = ['state' => SwapState::REFUNDED];
        $this->bot_event_logger->logSwapRefunded($swap_process['bot'], $swap_process['swap'], $receipt_update_vars, $swap_update_vars);

        // mark the swap as sent
        $swap_process['swap_was_sent'] = true;
    }

    protected function buildRefundDetails($bot, $xchain_notification) {
        if ($xchain_notification['asset'] == 'BTC') {
            // BTC Refund
            $fee = $bot['return_fee'];
            $dust_size = null;
            $out_quantity = max(0, $xchain_notification['quantity'] - $fee);
            $out_asset = $xchain_notification['asset'];

        } else {
            // Counterparty asset refund

            // // calculate a minimum fee
            // $input_dust_size_sat = $xchain_notification['counterpartyTx']['dustSizeSat'];
            // $fee_sat = floor($input_dust_size_sat * 0.2);
            // $dust_size_sat = $input_dust_size_sat - $fee_sat;
            // $fee = CurrencyUtil::satoshisToValue($fee_sat);
            // $dust_size = CurrencyUtil::satoshisToValue($dust_size_sat);

            // refunds must use minimum fees to be relayed by the network
            $fee = $bot['return_fee'];
            $dust_size = self::DEFAULT_REGULAR_DUST_SIZE;

            $out_asset = $xchain_notification['asset'];
            $out_quantity = $xchain_notification['quantity'];
        }

        return [$out_quantity, $out_asset, $fee, $dust_size];
    }

    protected function checkForPermanentlyFailedSwap($swap_process) {
        // Log::debug("checkForPermanentlyFailedSwap \$swap_process['state_trigger']={$swap_process['state_trigger']}");
        if ($swap_process['state_trigger'] == SwapStateEvent::SWAP_ERRORED OR (!$swap_process['state_trigger'] AND $swap_process['swap']['state'] == SwapState::ERROR)) {
            if ($swap_process['confirmations'] >= self::PERMANENTLY_FAIL_AFTER_CONFIRMATIONS) {
                $bot = (isset($swap_process['bot'])) ? $swap_process['bot'] : null;
                $swap = (isset($swap_process['swap'])) ? $swap_process['swap'] : null;
                $receipt = (isset($swap_process['swap_update_vars']['receipt'])) ? $swap_process['swap_update_vars']['receipt'] : null;
                $this->bot_event_logger->logSwapPermanentlyFailed($bot, $swap, $receipt);

                // trigger permanent error
                $swap_process['state_trigger'] = SwapStateEvent::SWAP_PERMANENTLY_ERRORED;
            }
        }
    }

    protected function handleUpdateSwapModel($swap_process) {
        // update the swap
        if ($swap_process['swap_update_vars']) {
            $update_vars = $this->swap_repository->mergeUpdateVars($swap_process['swap'], $swap_process['swap_update_vars']);
            $this->swap_repository->update($swap_process['swap'], $update_vars);
        }
    }

    protected function handleUpdateSwapState($swap_process) {
        // also trigger a state change
        if ($swap_process['state_trigger']) {
            $swap_process['swap']->stateMachine()->triggerEvent($swap_process['state_trigger']);
        }

    }

    protected function sendAssets($swap, $bot, $destination, $quantity, $asset, $fee, $dust_size, $request_id) {
        // call xchain
        if ($fee === null) { $fee = $bot['return_fee']; }
        $unconfirmed = false;
        $account_name = AccountHandler::swapAccountName($swap);
        $send_result = $this->xchain_client->sendFromAccount($bot['public_address_id'], $destination, $quantity, $asset, $account_name, $unconfirmed, $fee, $dust_size, $request_id);

        return $send_result;
    }

    protected function generateSendHash($type, Bot $bot, Swap $swap, $destination, $quantity, $asset) {
        return RequestIDGenerator::generateSendHash($type.','.$bot['uuid'].','.$swap['uuid'], $destination, $quantity, $asset);
    }

    protected function failsWhitelistTest(Bot $bot, $destination) {
        $failed_whitelist_test = false;

        // get the individual whitelists and the whitelisted file
        $allowed_whitelist_addresses = $bot->allWhitelistedAddresses();

        if (is_array($allowed_whitelist_addresses) AND $allowed_whitelist_addresses) {
            if ($destination AND in_array($destination, $allowed_whitelist_addresses)) {
                // there was a whitelist and the destination was in it
                $failed_whitelist_test = false;
            } else {
                // there was a whitelist and the destination was not in it
                $failed_whitelist_test = true;
            }
        }

        return $failed_whitelist_test;
    }


    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    protected function allSwapsAreComplete($transaction) {
        $all_swaps = $this->swap_repository->findByTransactionID($transaction['id']);
        $all_complete = true;
        if (count($all_swaps) == 0) { $all_complete = false; }

        foreach($all_swaps as $swap) {
            if (!$swap->wasSent()) {
                $all_complete = false;
                break;
            }
        }

        return $all_complete;
    }

    protected function buildMergedReceiptVars($swap_process) {
        if (isset($swap_process['swap']) AND isset($swap_process['swap']['receipt'])) {
            $receipt_vars = $swap_process['swap']['receipt'];

            if (isset($swap_process['swap_update_vars']['receipt'])) {
                $receipt_vars = array_merge($receipt_vars, $swap_process['swap_update_vars']['receipt']);
            }

            return $receipt_vars;
        }

        return null;
    }


    
    

}
