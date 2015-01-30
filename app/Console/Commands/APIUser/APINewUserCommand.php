<?php

namespace Swapbot\Console\Commands\APIUser;

use Swapbot\Providers\EventLog\Facade\EventLog;
use Illuminate\Console\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputOption;

class APINewUserCommand extends Command {

    /**
     * The console command name.
     *
     * @var string
     */
    protected $name = 'swapbot:new-user';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new API User';


    /**
     * {@inheritdoc}
     */
    protected function configure()
    {
        parent::configure();

        $this
            ->addArgument('email', InputArgument::REQUIRED, 'Email Address')
            ->addOption('password', 'p', InputOption::VALUE_OPTIONAL, 'Password', null)
            ->setHelp(<<<EOF
Create a new user with API Credentials
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
        $user_repository = $this->laravel->make('Swapbot\Repositories\UserRepository');
        $user_vars = [
            'email'            => $this->input->getArgument('email'),
            'password'         => $this->input->getOption('password'),

        ];
        $user_model = $user_repository->create($user_vars);
        
        // log
        EventLog::log('user.create.cli', $user_model, ['id', 'email', 'apisecretkey']);

        // show the new user
        $user = clone $user_model;
        $this->line(json_encode($user, 192));
    }

}