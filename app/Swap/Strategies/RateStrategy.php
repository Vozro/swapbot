<?php

namespace Swapbot\Swap\Strategies;

use Illuminate\Support\MessageBag;
use Swapbot\Models\Data\RefundConfig;
use Swapbot\Models\Data\SwapConfig;
use Swapbot\Swap\Contracts\Strategy;
use Swapbot\Swap\Rules\SwapRuleHandler;
use Swapbot\Swap\Strategies\StrategyHelpers;
use Swapbot\Util\Validator\ValidatorHelper;

class RateStrategy implements Strategy {

    function __construct(SwapRuleHandler $swap_rule_handler) {
        $this->swap_rule_handler = $swap_rule_handler;
    }

    public function shouldRefundTransaction(SwapConfig $swap_config, $quantity_in, $swap_rules=[], $receipt_vars=null) {
        // if there is a minimum and the input is below this minimum
        //   then it should be refunded
        if ($quantity_in < $swap_config['min']) {
            return true;
        }

        $swap_vars = $this->calculateInitialReceiptValues($swap_config, $quantity_in, $swap_rules);

        // never try to send 0 of an asset
        if ($swap_vars['quantityOut'] <= 0) { return true; }

        return false;
    }

    public function buildRefundReason(SwapConfig $swap_config, $quantity_in) {
        return RefundConfig::REASON_BELOW_MINIMUM;
    }


    public function calculateInitialReceiptValues(SwapConfig $swap_config, $quantity_in, $swap_rules=[]) {
        $raw_quantity_out = $quantity_in * $swap_config['rate'];
        $quantity_out = round($raw_quantity_out, 8);

        $receipt_values = [
            'quantityIn'  => $quantity_in,
            'assetIn'     => $swap_config['in'],

            'quantityOut' => $quantity_out,
            'assetOut'    => $swap_config['out'],
        ];

        // execute the rule engine
        $modified_quantity_out = $this->swap_rule_handler->modifyInitialQuantityOut($raw_quantity_out, $swap_rules, $quantity_in, $swap_config);
        if ($modified_quantity_out !== null) {
            $receipt_values['originalQuantityOut'] = $receipt_values['quantityOut'];
            $receipt_values['quantityOut'] = $modified_quantity_out;
        }

        return $receipt_values;
    }

    public function unSerializeDataToSwap($data, SwapConfig $swap_config) {
        // strategy is already set

        $swap_config['in']            = isset($data['in'])            ? $data['in']            : null;
        $swap_config['out']           = isset($data['out'])           ? $data['out']           : null;
        $swap_config['rate']          = isset($data['rate'])          ? $data['rate']          : null;
        $swap_config['min']           = isset($data['min'])           ? $data['min']           : 0;
        $swap_config['direction']     = isset($data['direction'])     ? $data['direction']     : SwapConfig::DIRECTION_SELL;
        $swap_config['swap_rule_ids'] = isset($data['swap_rule_ids']) ? $data['swap_rule_ids'] : null;

        if ($swap_config['direction'] == SwapConfig::DIRECTION_SELL) {
            $swap_config['price'] = isset($data['price']) ? $data['price'] : null;
        } else {
            $swap_config['price'] = null;
        }
    }

    public function serializeSwap(SwapConfig $swap_config) {
        return [
            'strategy'      => $swap_config['strategy'],
            'direction'     => ($swap_config['direction'] == SwapConfig::DIRECTION_BUY) ? SwapConfig::DIRECTION_BUY : SwapConfig::DIRECTION_SELL,
            'in'            => $swap_config['in'],
            'out'           => $swap_config['out'],
            'rate'          => $swap_config['rate'],
            'price'         => ($swap_config['direction'] == SwapConfig::DIRECTION_SELL ? $swap_config['price'] : null),
            'min'           => $swap_config['min'],
            'swap_rule_ids' => $swap_config['swap_rule_ids'],
        ];
    }

    public function validateSwap($swap_number, $swap_config, MessageBag $errors) {
        $in_value        = isset($swap_config['in'])        ? $swap_config['in']        : null;
        $out_value       = isset($swap_config['out'])       ? $swap_config['out']       : null;
        $rate_value      = isset($swap_config['rate'])      ? $swap_config['rate']      : null;
        $price_value     = isset($swap_config['price'])     ? $swap_config['price']     : (($rate_value AND $rate_value > 0) ? (1 / $rate_value) : null);
        $min_value       = isset($swap_config['min'])       ? $swap_config['min']       : null;
        $direction_value = isset($swap_config['direction']) ? $swap_config['direction'] : SwapConfig::DIRECTION_SELL;

        $exists = (strlen($in_value) OR strlen($out_value) OR strlen($rate_value));
        if ($exists) {
            $assets_are_valid = true;

            // direction
            if ($direction_value != SwapConfig::DIRECTION_SELL AND $direction_value != SwapConfig::DIRECTION_BUY) {
                $errors->add('direction', "Please specify a valid direction for swap #{$swap_number}");
            }

            // in and out assets
            if (!StrategyHelpers::validateAssetName($in_value, 'receive', $swap_number, 'in', $errors)) { $assets_are_valid = false; }
            if (!StrategyHelpers::validateAssetName($out_value, 'send', $swap_number, 'out', $errors)) { $assets_are_valid = false; }

            // rate
            if (strlen($rate_value)) {
                if (!StrategyHelpers::isValidRate($rate_value)) {
                    $errors->add('rate', "The rate for swap #{$swap_number} was not valid.");
                }
            } else {
                $errors->add('rate', "Please specify a valid rate for swap #{$swap_number}");
            }

            // price
            if (strlen($price_value)) {
                if (!StrategyHelpers::isValidPrice($price_value)) {
                    $errors->add('price', "The price for swap #{$swap_number} was not valid.");
                }
            } else {
                $errors->add('price', "Please specify a valid price for swap #{$swap_number}");
            }

            // min
            if (strlen($min_value)) {
                if (!ValidatorHelper::isValidQuantityOrZero($min_value)) {
                    $errors->add('min', "The minimum value for swap #{$swap_number} was not valid.");
                }
            } else {
                $errors->add('min', "Please specify a valid minimum value for swap #{$swap_number}");
            }


            // make sure assets aren't the same
            if ($assets_are_valid AND $in_value == $out_value) {
                $errors->add('rate', "The assets to receive and send for swap #{$swap_number} should not be the same.");
            }
        } else {
            $errors->add('swaps', "The values specified for swap #{$swap_number} were not valid.");
        }
    }

    public function validateSwapRuleConfig($swap_rule, MessageBag $errors) {

    }

    ////////////////////////////////////////////////////////////////////////
    // Index

    public function buildIndexEntries(SwapConfig $swap_config) {
        return [
            [
                'in'   => $swap_config['in'],
                'out'  => $swap_config['out'],
                // 'rate' => $swap_config['rate'],
                'cost' => $swap_config['rate'] > 0 ? (1 / $swap_config['rate']) : 0,
            ]
        ];
    }

    public function buildSwapDetailsForAPI(SwapConfig $swap_config, $in=null) {
        return [
            'in'   => $swap_config['in'],
            'out'  => $swap_config['out'],
            'rate' => $swap_config['rate'],
            'cost' => $swap_config['rate'] > 0 ? (1 / $swap_config['rate']) : 0,
            'min'  => $swap_config['min'],
        ];
    }


}
