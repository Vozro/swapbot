<?php

namespace Swapbot\Swap\Strategies;

use Illuminate\Support\MessageBag;
use Swapbot\Models\Data\SwapConfig;
use Swapbot\Swap\Contracts\Strategy;
use Swapbot\Swap\Strategies\StrategyHelpers;
use Tokenly\QuotebotClient\Client as QuotebotClient;

class FiatStrategy implements Strategy {

    function __construct(QuotebotClient $quotebot_client) {
        $this->quotebot_client = $quotebot_client;
    }

    public function shouldRefundTransaction(SwapConfig $swap_config, $quantity_in) {
        // // if there is a minimum and the input is below this minimum
        // //   then it should be refunded
        // if ($quantity_in < $swap_config['min']) {
        //     return true;
        // }

        return false;
    }

    public function caculateInitialReceiptValues(SwapConfig $swap_config, $quantity_in) {
        $conversion_rate = $this->getFiatConversionRate($swap_config['in'], $swap_config['fiat'], $swap_config['source']);
        $quantity_out = $quantity_in * $conversion_rate / $swap_config['cost'];
        $asset_out = $swap_config['out'];

        return [
            'quantityIn'  => $quantity_in,
            'assetIn'     => $swap_config['in'],

            'quantityOut' => $quantity_out,
            'assetOut'    => $swap_config['out'],
        ];
    }

    public function unSerializeDataToSwap($data, SwapConfig $swap_config) {
        // strategy is already set

        $swap_config['in']        = isset($data['in'])        ? $data['in']        : null;
        $swap_config['out']       = isset($data['out'])       ? $data['out']       : null;
        $swap_config['cost']      = isset($data['cost'])      ? $data['cost']      : null;

        $swap_config['type']      = isset($data['type'])      ? $data['type']      : 'buy';
        $swap_config['min_out']   = isset($data['min_out'])   ? $data['min_out']   : 0;
        $swap_config['divisible'] = isset($data['divisible']) ? $data['divisible'] : false;

        $swap_config['fiat']      = isset($data['fiat'])      ? $data['fiat']      : 'USD';
        $swap_config['source']    = isset($data['source'])    ? $data['source']    : 'bitcoinAverage';
    }

    public function serializeSwap(SwapConfig $swap_config) {
        return [
            'strategy'  => $swap_config['strategy'],
            'in'        => $swap_config['in'],
            'out'       => $swap_config['out'],
            'cost'      => $swap_config['cost'],
            'type'      => $swap_config['type'],
            'divisible' => $swap_config['divisible'],
            'min_out'   => $swap_config['min_out'],

            'fiat'      => $swap_config['fiat'],
            'source'    => $swap_config['source'],
        ];
    }

    public function validateSwap($swap_config_number, $swap_config, MessageBag $errors) {
        // unimplemented
        return;

        $in_value   = isset($swap_config['in'])   ? $swap_config['in']   : null;
        $out_value  = isset($swap_config['out'])  ? $swap_config['out']  : null;
        $rate_value = isset($swap_config['cost']) ? $swap_config['cost'] : null;
        $min_value  = isset($swap_config['min'])  ? $swap_config['min']  : null;

        $exists = (strlen($in_value) OR strlen($out_value) OR strlen($rate_value));
        if ($exists) {
            $assets_are_valid = true;

            // in and out assets
            if (!StrategyHelpers::validateAssetName($in_value, 'receive', $swap_config_number, 'in', $errors)) { $assets_are_valid = false; }
            if (!StrategyHelpers::validateAssetName($out_value, 'send', $swap_config_number, 'out', $errors)) { $assets_are_valid = false; }

            // rate
            if (strlen($rate_value)) {
                if (!StrategyHelpers::isValidRate($rate_value)) {
                    $errors->add('cost', "The rate for swap #{$swap_config_number} was not valid.");
                }
            } else {
                $errors->add('cost', "Please specify a valid rate for swap #{$swap_config_number}");
            }

            // min
            if (strlen($min_value)) {
                if (!StrategyHelpers::isValidQuantityOrZero($min_value)) {
                    $errors->add('min', "The minimum value for swap #{$swap_config_number} was not valid.");
                }
            } else {
                $errors->add('min', "Please specify a valid minimum value for swap #{$swap_config_number}");
            }


            // make sure assets aren't the same
            if ($assets_are_valid AND $in_value == $out_value) {
                $errors->add('cost', "The assets to receive and send for swap #{$swap_config_number} should not be the same.");
            }
        } else {
            $errors->add('swaps', "The values specified for swap #{$swap_config_number} were not valid.");
        }
    }

    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    // Conversion

    protected function getFiatConversionRate($asset, $fiat, $source) {
        $quote_entry = $this->quotebot_client->getQuote($source, [$fiat, $asset]);

        return $quote_entry['last'];
    }
    
    

}