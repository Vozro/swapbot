<?php

use Swapbot\Repositories\SettingRepository;

class SettingHelper  {

    function __construct(SettingRepository $setting_repository) {
        $this->setting_repository = $setting_repository;
    }

    public function sampleSettingVars($override_vars = []) {
        return array_replace_recursive([
            'name'  => 'foo',
            'value' => ['bar' => 'baz', 'bar2' => 'baz2'],
        ], $override_vars);
    }

    public function newSampleSetting($vars=[]) {
        if (!isset($this->setting_uuid)) { $this->setting_uuid = 0; }
            else { ++$this->setting_uuid; }
        $attributes = array_merge($this->sampleSettingVars(), ['name' => 'foo'.(($this->setting_uuid > 0) ? ('_'.$this->setting_uuid) : '')], $vars);

        // create the model
        return $this->setting_repository->create($attributes);
    }

}
