<?php

namespace Swapbot\Console\Commands\Development;

use Exception;
use Illuminate\Console\Command;
use Illuminate\Foundation\Bus\DispatchesCommands;
use Swapbot\Models\BotEvent;
use Tokenly\LaravelEventLog\Facade\EventLog;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;

class TestCreateBotEventCommand extends Command {

    use DispatchesCommands;

    /**
     * The console command name.
     *
     * @var string
     */
    protected $name = 'swapbot:send-bot-event';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sends a test event';


    /**
     * {@inheritdoc}
     */
    protected function configure()
    {
        parent::configure();

        $this
            ->addArgument('bot-id', InputArgument::REQUIRED, 'Bot ID')
            ->addArgument('event', InputArgument::REQUIRED, 'Event JSON')
            ->addOption('level', 'l', InputOption::VALUE_OPTIONAL, 'Event level', BotEvent::LEVEL_INFO)
            ->setHelp(<<<EOF
Sends a test event
EOF
        );
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function fire()
    {
        $bot_id = $this->input->getArgument('bot-id');

        // try a file
        $event_arg = $this->input->getArgument('event');
        if (strstr($event_arg, '{')) {
            // interpret as raw JSON
            $event = json_decode($event_arg);
        } else {
            // assume file
            if (file_exists($event_arg)) {
                $event = json_decode(file_get_contents($event_arg), true);
            } else {
                $this->error("File $event_arg not found");
                return;
            }
        }

        if (!$event) {
            throw new Exception("Unable to decode event", 1);
        }

        $bot_repository = $this->laravel->make('Swapbot\Repositories\BotRepository');
        $bot = $bot_repository->findByUuid($bot_id);
        if (!$bot) { $bot = $bot_repository->findByID($bot_id); }
        if (!$bot) {
            throw new Exception("Unable to find bot", 1);
        }

        $this->info("Creating event for bot ".$bot['name']." ({$bot['uuid']})");
        $level = $this->input->getOption('level');
        app('Swapbot\Swap\Logger\BotEventLogger')->createLegacyBotEvent($bot, $level, $event);
        $this->info("done");
    }

}
