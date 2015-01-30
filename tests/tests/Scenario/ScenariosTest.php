<?php

use Illuminate\Support\Facades\Log;
use \PHPUnit_Framework_Assert as PHPUnit;

class ScenariosTest extends TestCase {

    protected $use_database = true;


    public function testSingleScenario() {
        $scenario_number = getenv('SCENARIO');

        if ($scenario_number !== false) {
            $this->runScenario($scenario_number);
        }
    } 

    public function testAllScenarios() {
        // do all state tests in directory
        $scenario_number_count = count(glob(base_path().'/tests/fixtures/scenarios/*.yml'));
        PHPUnit::assertGreaterThan(0, $scenario_number_count);
        for ($i=1; $i <= $scenario_number_count; $i++) { 
            Log::debug("BEGIN SCENARIO: $i");
            // clear the db
            if ($i > 1) { $this->resetForScenario(); }

            try {
                $this->runScenario($i);
            } catch (Exception $e) {
                echo "\nFailed while running scenario $i\n";
                throw $e;
            }
        }
    }


    protected function runScenario($scenario_number) {
        // $this->init();

        $filename = "scenario".sprintf('%02d', $scenario_number).".yml";
        $scenario_runner = $this->getScenarioRunner();
        $scenario_data = $scenario_runner->loadScenario($filename);
        $scenario_runner->runScenario($scenario_data);
        $scenario_runner->validateScenario($scenario_data);
    }

    protected function getScenarioRunner() {
        if (!isset($this->scenario_runner)) {
            $this->scenario_runner = $this->app->make('\ScenarioRunner')->init($this);
        }
        return $this->scenario_runner;
    }


    protected function resetForScenario() {
        // reset the DB
        $this->teardownDb();
        $this->setUpDb();

        // reset the scenario runner
        $this->scenario_runner = null;
    }

    protected function drainQueue() {
        // make sure scenario runner exists
        $this->getScenarioRunner();
    }

}
