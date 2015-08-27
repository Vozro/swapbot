<?php

namespace Swapbot\Http\Controllers\API\Swap;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Swapbot\Http\Controllers\API\Base\APIController;
use Swapbot\Repositories\BotRepository;
use Swapbot\Repositories\SwapIndexRepository;
use Swapbot\Swap\Factory\StrategyFactory;
use Tokenly\LaravelApiProvider\Filter\IndexRequestFilter;
use Tokenly\LaravelApiProvider\Helpers\APIControllerHelper;

class PublicAvailableSwapsController extends APIController {

    protected $protected = false;

    public function addMiddleware() {
        parent::addMiddleware();

        // allow cors
        $this->middleware('cors');
    }

    /**
     * Display a listing of the resource.
     *
     * @param  Guard               $auth
     * @param  BotRepository       $repository
     * @param  APIControllerHelper $api_helper
     * @return Response
     */
    public function index(Request $request, BotRepository $bot_repository, SwapIndexRepository $swap_index_repository, StrategyFactory $swap_strategy_factory, APIControllerHelper $api_helper)
    {
        // find all the swaps from the index
        $available_swaps = $swap_index_repository->findAll($this->buildFilter($request, $swap_index_repository));

        // format for API
        $available_swaps_output = [];
        foreach($available_swaps as $available_swap) {
            $swap_config = $available_swap['swap'];
            $swap_details_for_api = $swap_strategy_factory->getStrategy($swap_config['strategy'])->buildSwapDetailsForAPI($swap_config, $request->input('inToken'));

            $available_swap_output = [
                'swap' => $swap_details_for_api,
                'bot'  => $available_swap['bot']->serializeForAPI('public_simple'),
            ];
            $available_swaps_output[] = $available_swap_output;
        }

        // return JSON
        return $api_helper->buildJSONResponse($available_swaps_output);
    }


    protected function buildFilter(Request $request, SwapIndexRepository $swap_index_repository) {
        return IndexRequestFilter::createFromRequest($request, $swap_index_repository->buildFindAllFilterDefinition());
    }


}